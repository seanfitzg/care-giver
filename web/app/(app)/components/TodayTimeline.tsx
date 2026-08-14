'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ScheduledItem {
  id: string;
  type: 'medication_scheduled' | 'nutrition' | 'activity';
  name: string;
  time_of_day: string;
  overdue_window_minutes: number;
  days_of_week: number[] | null;
}

interface EventEntry {
  id: string;
  scheduled_item_id: string | null;
  carer_id: string | null;
  occurred_at: string;
  status: 'completed' | 'missed' | 'skipped';
  event_type: 'medication_scheduled' | 'as_needed_medication' | 'nutrition' | 'activity';
}

interface CarerName {
  user_id: string;
  display_name: string;
}

type ItemStatus = 'pending' | 'overdue' | 'completed' | 'missed' | 'skipped';

interface TimelineItem {
  scheduledItem: ScheduledItem;
  event: EventEntry | null;
  status: ItemStatus;
}

interface Props {
  careRecipientId: string;
  scheduledItems: ScheduledItem[];
  initialEvents: EventEntry[];
  carerNames: CarerName[];
  serverTimeISO: string;
  todayLabel: string;
}

const STATUS_SORT: Record<ItemStatus, number> = {
  overdue: 0,
  pending: 1,
  completed: 2,
  missed: 2,
  skipped: 2,
};

const STATUS_COLORS: Record<
  ItemStatus,
  { border: string; bg: string; labelText: string; labelBg: string; nameColor: string }
> = {
  overdue: {
    border: '#dc2626',
    bg: '#fff',
    labelBg: '#fee2e2',
    labelText: '#dc2626',
    nameColor: '#111827',
  },
  pending: {
    border: '#d1d5db',
    bg: '#fff',
    labelBg: '#f3f4f6',
    labelText: '#374151',
    nameColor: '#111827',
  },
  completed: {
    border: '#16a34a',
    bg: '#f0fdf4',
    labelBg: '#dcfce7',
    labelText: '#16a34a',
    nameColor: '#111827',
  },
  missed: {
    border: '#ef4444',
    bg: '#fff7f7',
    labelBg: '#fee2e2',
    labelText: '#dc2626',
    nameColor: '#6b7280',
  },
  skipped: {
    border: '#d1d5db',
    bg: '#f9fafb',
    labelBg: '#f3f4f6',
    labelText: '#9ca3af',
    nameColor: '#9ca3af',
  },
};

function computeStatus(item: ScheduledItem, event: EventEntry | null, now: Date): ItemStatus {
  if (event) return event.status as ItemStatus;
  // Compare time_of_day (HH:MM:SS stored in GMT) against current UTC time as a string.
  // String comparison is safe because both sides are zero-padded HH:MM:SS.
  const utcTime =
    String(now.getUTCHours()).padStart(2, '0') +
    ':' +
    String(now.getUTCMinutes()).padStart(2, '0') +
    ':' +
    String(now.getUTCSeconds()).padStart(2, '0');
  return item.time_of_day <= utcTime ? 'overdue' : 'pending';
}

function formatTimeOfDay(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  return `${h}:${m}`;
}

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  return (
    String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0')
  );
}

function typeLabel(type: string): string {
  if (type === 'medication_scheduled') return 'Medication';
  if (type === 'nutrition') return 'Nutrition';
  return 'Activity';
}

function statusLabel(status: ItemStatus): string {
  if (status === 'overdue') return 'Overdue';
  if (status === 'pending') return 'Pending';
  if (status === 'completed') return 'Completed';
  if (status === 'missed') return 'Missed';
  return 'Skipped';
}

export default function TodayTimeline({
  careRecipientId,
  scheduledItems,
  initialEvents,
  carerNames,
  serverTimeISO,
  todayLabel,
}: Props) {
  const router = useRouter();
  const [events, setEvents] = useState<EventEntry[]>(initialEvents);
  // Initialise from the server timestamp so server and client render identically.
  const [now, setNow] = useState(() => new Date(serverTimeISO));

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Refresh server data when the UTC date rolls over midnight so scheduled
  // items and events are fetched for the new day.
  useEffect(() => {
    if (now.toISOString().slice(0, 10) !== serverTimeISO.slice(0, 10)) {
      router.refresh();
    }
  }, [now, serverTimeISO, router]);

  useEffect(() => {
    const supabase = createClient();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const channel = supabase
      .channel(`today-timeline-${careRecipientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_log',
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        (payload) => {
          const newEvent = payload.new as EventEntry;
          if (new Date(newEvent.occurred_at) >= dayStart) {
            setEvents((prev) => {
              if (prev.some((e) => e.id === newEvent.id)) return prev;
              return [...prev, newEvent];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [careRecipientId]);

  const carerMap = new Map(carerNames.map((c) => [c.user_id, c.display_name]));

  // Build a map of scheduled_item_id → latest event (by occurred_at) so that
  // a carer-recorded 'completed' event always wins over an earlier cron-inserted
  // 'missed' event for the same item.
  const latestEventMap = new Map<string, EventEntry>();
  for (const e of events) {
    if (e.scheduled_item_id === null) continue;
    const existing = latestEventMap.get(e.scheduled_item_id);
    if (!existing || e.occurred_at > existing.occurred_at) {
      latestEventMap.set(e.scheduled_item_id, e);
    }
  }

  const items: TimelineItem[] = scheduledItems.map((item) => {
    const event = latestEventMap.get(item.id) ?? null;
    return { scheduledItem: item, event, status: computeStatus(item, event, now) };
  });

  items.sort((a, b) => {
    const orderDiff = STATUS_SORT[a.status] - STATUS_SORT[b.status];
    if (orderDiff !== 0) return orderDiff;
    return a.scheduledItem.time_of_day.localeCompare(b.scheduledItem.time_of_day);
  });

  const overduCount = items.filter((i) => i.status === 'overdue').length;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Today</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{todayLabel}</p>
        </div>
        {overduCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#fee2e2',
              color: '#dc2626',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: 20,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#dc2626',
              }}
            />
            {overduCount} overdue
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            color: '#9ca3af',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>
            No items scheduled for today
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(({ scheduledItem: item, event, status }) => {
            const colors = STATUS_COLORS[status];
            const carer = event?.carer_id ? carerMap.get(event.carer_id) : null;

            return (
              <div
                key={item.id}
                style={{
                  background: colors.bg,
                  border: '1px solid #e5e7eb',
                  borderLeft: `4px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <div style={{ flexShrink: 0, minWidth: 50, paddingTop: 2 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#374151' }}>
                    {formatTimeOfDay(item.time_of_day)}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: status === 'completed' || status === 'missed' ? 6 : 0,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600, color: colors.nameColor }}>
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '2px 7px',
                        borderRadius: 20,
                        background: '#f3f4f6',
                        color: '#6b7280',
                        flexShrink: 0,
                      }}
                    >
                      {typeLabel(item.type)}
                    </span>
                  </div>

                  {status === 'completed' && event && (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Recorded by {carer ?? 'a carer'} at {formatOccurredAt(event.occurred_at)}
                    </div>
                  )}
                  {status === 'missed' && (
                    <div style={{ fontSize: 12, color: '#dc2626' }}>Not recorded in time</div>
                  )}
                </div>

                <div style={{ flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: colors.labelBg,
                      color: colors.labelText,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
