import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ItemType = 'medication_scheduled' | 'nutrition' | 'activity';
export type ItemStatus = 'overdue' | 'done' | 'missed' | 'upcoming';
export type NutritionType = 'bolus' | 'oral_self' | 'oral_carer';

export type TimelineItem = {
  key: string;
  scheduledItemId: string;
  type: ItemType;
  name: string;
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
  time_of_day: string | null;
  interval_minutes: number | null;
  overdue_window_minutes: number;
  missed_threshold_minutes: number;
  is_compulsory: boolean;
  bolus_rest_minutes: number | null;
  nutrition_type: NutritionType | null;
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

// Configurable window defaults — replace with per-user preferences once a
// preferences table exists.
export const PAST_HOURS = 2;
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

function generateNutritionTimes(intervalMinutes: number): Date[] {
  const { start, end } = todayBounds();
  const times: Date[] = [];
  let t = start.getTime();
  while (t <= end.getTime()) {
    times.push(new Date(t));
    t += intervalMinutes * 60_000;
  }
  return times;
}

function computeStatus(
  scheduledAt: Date,
  scheduledItemId: string,
  overdueWindow: number,
  missedThreshold: number,
  todayEvents: EventLogRow[],
  now: Date,
  earliestMs: number,
): ItemStatus {
  const scheduledMs = scheduledAt.getTime();
  const match = todayEvents.find((e) => {
    if (e.scheduled_item_id !== scheduledItemId) return false;
    const eMs = new Date(e.occurred_at).getTime();
    return eMs >= earliestMs && eMs <= scheduledMs + missedThreshold * 60_000;
  });

  if (match) return match.status === 'completed' ? 'done' : 'missed';

  const nowMs = now.getTime();
  if (nowMs > scheduledMs + missedThreshold * 60_000) return 'missed';
  if (nowMs > scheduledMs + overdueWindow * 60_000) return 'overdue';
  return 'upcoming';
}

export function buildTimelineItems(
  scheduledItems: ScheduledItemRow[],
  todayEvents: EventLogRow[],
  now: Date,
  carerNames: Record<string, string> = {},
  pastHours = PAST_HOURS,
  futureHours = FUTURE_HOURS,
): TimelineItem[] {
  const windowStart = new Date(now.getTime() - pastHours * 3_600_000);
  const windowEnd = new Date(now.getTime() + futureHours * 3_600_000);
  const items: TimelineItem[] = [];

  const dayStartMs = todayBounds().start.getTime();

  for (const row of scheduledItems) {
    const times: Date[] =
      row.type === 'nutrition' && row.interval_minutes
        ? generateNutritionTimes(row.interval_minutes)
        : row.time_of_day
          ? [scheduledTimeToday(row.time_of_day)]
          : [];

    for (let i = 0; i < times.length; i++) {
      const scheduledAt = times[i];
      // For the first occurrence use start-of-day so early recordings are captured;
      // for subsequent occurrences use the previous occurrence's missed-threshold boundary
      // to avoid double-attributing one event to two slots.
      const earliestMs =
        i === 0 ? dayStartMs : times[i - 1].getTime() + row.missed_threshold_minutes * 60_000;

      const status = computeStatus(
        scheduledAt,
        row.id,
        row.overdue_window_minutes,
        row.missed_threshold_minutes,
        todayEvents,
        now,
        earliestMs,
      );

      // Overdue items always appear; others are filtered to the window.
      const inWindow =
        status === 'overdue' || (scheduledAt >= windowStart && scheduledAt <= windowEnd);
      if (!inWindow) continue;

      let completedByName: string | undefined;
      if (status === 'done') {
        const completionEvent = todayEvents.find(
          (e) =>
            e.scheduled_item_id === row.id &&
            e.status === 'completed' &&
            e.carer_id != null &&
            new Date(e.occurred_at).getTime() >= earliestMs &&
            new Date(e.occurred_at).getTime() <=
              scheduledAt.getTime() + row.missed_threshold_minutes * 60_000,
        );
        if (completionEvent?.carer_id) {
          completedByName = carerNames[completionEvent.carer_id];
        }
      }

      items.push({
        key: `${row.id}_${scheduledAt.getTime()}`,
        scheduledItemId: row.id,
        type: row.type,
        name: row.name,
        scheduledAt,
        status,
        isCompulsory: row.is_compulsory,
        completedByName,
        bolusRestMinutes: row.bolus_rest_minutes ?? undefined,
        nutritionType: row.nutrition_type ?? undefined,
      });
    }
  }

  return items.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

async function fetchData(careRecipientId: string): Promise<FetchedTimeline> {
  const { start, end } = todayBounds();
  const [
    { data: items, error: itemsErr },
    { data: events, error: eventsErr },
    { data: names, error: namesErr },
  ] = await Promise.all([
    supabase
      .from('scheduled_items')
      .select(
        'id, type, name, time_of_day, interval_minutes, overdue_window_minutes, missed_threshold_minutes, is_compulsory, bolus_rest_minutes, nutrition_type',
      )
      .eq('care_recipient_id', careRecipientId),
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
