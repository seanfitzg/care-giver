import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ItemType = 'medication_scheduled' | 'nutrition' | 'activity';
export type ItemStatus = 'overdue' | 'done' | 'missed' | 'skipped' | 'upcoming';
export type NutritionType = 'bolus' | 'oral_self' | 'oral_carer';

export type TimelineItem = {
  key: string;
  scheduledItemId: string;
  type: ItemType;
  name: string;
  description?: string;
  scheduledAt: Date;
  status: ItemStatus;
  isCompulsory: boolean;
  completedByName?: string;
  bolusRestMinutes?: number;
  nutritionType?: NutritionType;
};

type ScheduledItemRow = {
  id: string;
  type: ItemType;
  name: string;
  description: string | null;
  time_of_day: string | null;
  overdue_window_minutes: number;
  is_compulsory: boolean;
  bolus_rest_minutes: number | null;
  nutrition_type: NutritionType | null;
  days_of_week: number[] | null;
};

type EventLogRow = {
  id: string;
  scheduled_item_id: string | null;
  occurred_at: string;
  status: 'completed' | 'missed' | 'skipped';
  carer_id: string | null;
};

export type FetchedTimeline = {
  scheduledItems: ScheduledItemRow[];
  todayEvents: EventLogRow[];
  carerNames: Record<string, string>;
};

// Configurable window default — replace with per-user preferences once a
// preferences table exists. Only bounds how far ahead 'upcoming' items show;
// overdue/done/missed/skipped items always show for the full day.
export const FUTURE_HOURS = 6;

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function scheduledTimeToday(timeOfDay: string): Date {
  const { start } = todayBounds();
  const [h, m] = timeOfDay.split(':').map(Number);
  return new Date(start.getTime() + (h * 60 + m) * 60_000);
}

// The latest event wins — a carer-recorded 'completed' event (which may be
// logged well after the overdue window closes, e.g. a late catch-up) always
// overrides an earlier cron-inserted 'missed' event for the same item.
function buildLatestEventMap(todayEvents: EventLogRow[]): Map<string, EventLogRow> {
  const latestByItem = new Map<string, EventLogRow>();
  for (const e of todayEvents) {
    if (!e.scheduled_item_id) continue;
    const existing = latestByItem.get(e.scheduled_item_id);
    if (!existing || e.occurred_at > existing.occurred_at) {
      latestByItem.set(e.scheduled_item_id, e);
    }
  }
  return latestByItem;
}

function computeStatus(
  scheduledAt: Date,
  overdueWindow: number,
  latestEvent: EventLogRow | null,
  now: Date,
  isCompulsory: boolean,
): ItemStatus {
  if (latestEvent) {
    if (latestEvent.status === 'completed') return 'done';
    if (latestEvent.status === 'skipped') return 'skipped';
    return 'missed';
  }

  const scheduledMs = scheduledAt.getTime();
  const windowEndMs = scheduledMs + overdueWindow * 60_000;
  const nowMs = now.getTime();
  // Only compulsory items are ever auto-marked missed (mirrors
  // mark_missed_events() in the DB) — non-compulsory items stay 'overdue'
  // indefinitely until completed or skipped.
  if (nowMs > windowEndMs) return isCompulsory ? 'missed' : 'overdue';
  if (nowMs >= scheduledMs) return 'overdue';
  return 'upcoming';
}

export function buildTimelineItems(
  scheduledItems: ScheduledItemRow[],
  todayEvents: EventLogRow[],
  now: Date,
  carerNames: Record<string, string> = {},
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const latestEventByItem = buildLatestEventMap(todayEvents);

  for (const row of scheduledItems) {
    if (!row.time_of_day) continue;
    const scheduledAt = scheduledTimeToday(row.time_of_day);
    const latest = latestEventByItem.get(row.id) ?? null;
    const status = computeStatus(
      scheduledAt,
      row.overdue_window_minutes,
      latest,
      now,
      row.is_compulsory,
    );

    const completedByName =
      status === 'done' && latest?.carer_id ? carerNames[latest.carer_id] : undefined;

    items.push({
      key: `${row.id}_${scheduledAt.getTime()}`,
      scheduledItemId: row.id,
      type: row.type,
      name: row.name,
      description: row.description ?? undefined,
      scheduledAt,
      status,
      isCompulsory: row.is_compulsory,
      completedByName,
      bolusRestMinutes: row.bolus_rest_minutes ?? undefined,
      nutritionType: row.nutrition_type ?? undefined,
    });
  }

  return items.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

async function fetchData(careRecipientId: string): Promise<FetchedTimeline> {
  const { start, end } = todayBounds();
  const todayDow = new Date().getDay();
  const [
    { data: items, error: itemsErr },
    { data: events, error: eventsErr },
    { data: names, error: namesErr },
  ] = await Promise.all([
    supabase
      .from('scheduled_items')
      .select(
        'id, type, name, description, time_of_day, overdue_window_minutes, is_compulsory, bolus_rest_minutes, nutrition_type, days_of_week',
      )
      .eq('care_recipient_id', careRecipientId)
      .or(`days_of_week.is.null,days_of_week.cs.{${todayDow}}`),
    supabase
      .from('event_log')
      .select('id, scheduled_item_id, occurred_at, status, carer_id')
      .eq('care_recipient_id', careRecipientId)
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString()),
    supabase.rpc('get_carer_names', { p_care_recipient_id: careRecipientId }),
  ]);

  if (itemsErr) throw itemsErr;
  if (eventsErr) throw eventsErr;
  if (namesErr) throw namesErr;

  const carerNames: Record<string, string> = {};
  for (const row of names ?? []) {
    carerNames[row.user_id] = row.display_name;
  }

  return {
    scheduledItems: (items ?? []) as ScheduledItemRow[],
    todayEvents: (events ?? []) as EventLogRow[],
    carerNames,
  };
}

export function useTimeline(careRecipientId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['timeline', careRecipientId],
    queryFn: () => fetchData(careRecipientId!),
    enabled: !!careRecipientId,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`timeline:${careRecipientId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_items',
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['timeline', careRecipientId] }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_log',
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['timeline', careRecipientId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [careRecipientId, qc]);

  const now = new Date();
  const items = query.data
    ? buildTimelineItems(
        query.data.scheduledItems,
        query.data.todayEvents,
        now,
        query.data.carerNames,
      )
    : [];

  return { items, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}
