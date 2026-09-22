'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BulkCatchUpModal from './BulkCatchUpModal';
import Icon from './Icon';
import { primaryBtnStyle, secondaryBtnStyle } from './modalStyles';
import PRNMedicationModal from './PRNMedicationModal';
import RecordItemModal from './RecordItemModal';
import ScheduledItemDetailModal from './ScheduledItemDetailModal';
import {
  formatTimeOfDay,
  typeLabel,
  type CarerName,
  type EventEntry,
  type ItemStatus,
  type PRNMedication,
  type ScheduledItem,
} from './types';

interface TimelineItem {
  scheduledItem: ScheduledItem;
  event: EventEntry | null;
  status: ItemStatus;
}

const TYPE_CONFIG: Record<ScheduledItem['type'], { icon: string; color: string; bg: string }> = {
  medication_scheduled: { icon: 'medkit', color: '#2563eb', bg: '#eff6ff' },
  nutrition: { icon: 'water', color: '#d97706', bg: '#fffbeb' },
  activity: { icon: 'walk', color: '#16a34a', bg: '#f0fdf4' },
};

interface Props {
  careRecipientId: string;
  carerId: string;
  scheduledItems: ScheduledItem[];
  initialEvents: EventEntry[];
  carerNames: CarerName[];
  asNeededMedications: PRNMedication[];
  serverTimeISO: string;
  todayLabel: string;
}

// overdue and missed share a tier — both are incomplete and both are swept
// up by "Mark all as done" — so they sit together above Upcoming.
const STATUS_SORT: Record<ItemStatus, number> = {
  overdue: 0,
  missed: 0,
  pending: 1,
  completed: 2,
  skipped: 2,
};

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 8,
        marginBottom: 2,
      }}
    >
      {title}
    </div>
  );
}

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

// Same default horizon as the RN app's FUTURE_HOURS, kept in sync manually
// since web and native don't share code.
const UPCOMING_PREVIEW_HOURS = 6;

function timeOfDayToDate(timeOfDay: string, now: Date): Date {
  const [h, m, s] = timeOfDay.split(':').map(Number);
  const d = new Date(now);
  d.setUTCHours(h, m, s || 0, 0);
  return d;
}

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  return (
    String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0')
  );
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
  carerId,
  scheduledItems,
  initialEvents,
  carerNames,
  asNeededMedications,
  serverTimeISO,
  todayLabel,
}: Props) {
  const router = useRouter();
  const [events, setEvents] = useState<EventEntry[]>(initialEvents);
  const [activeItem, setActiveItem] = useState<ScheduledItem | null>(null);
  const [detailItem, setDetailItem] = useState<{
    item: ScheduledItem;
    status: ItemStatus;
  } | null>(null);
  const [prnModalOpen, setPrnModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  // Initialise from the server timestamp so server and client render identically.
  const [now, setNow] = useState(() => new Date(serverTimeISO));

  function handleRecorded(event: EventEntry) {
    setEvents((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      return [...prev, event];
    });
  }

  function handleBulkRecorded(newEvents: EventEntry[]) {
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      return [...prev, ...newEvents.filter((e) => !existingIds.has(e.id))];
    });
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    const tick = () => setNow(new Date());
    const correctionId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 30_000);
    return () => {
      clearTimeout(correctionId);
      clearInterval(intervalId);
    };
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

  // Section header boundaries within the sorted list — items is already
  // grouped by STATUS_SORT tier, so the first index of each tier is where
  // its header belongs.
  const firstUpcomingIndex = items.findIndex((i) => i.status === 'pending');
  const firstEarlierIndex = items.findIndex(
    (i) => i.status === 'completed' || i.status === 'skipped',
  );

  // By default, "Upcoming" is capped to the next few hours so the list stays
  // short; "View all" reveals the rest of today's scheduled items.
  const upcomingCutoff = new Date(now.getTime() + UPCOMING_PREVIEW_HOURS * 3_600_000);
  const totalUpcomingCount = items.filter((i) => i.status === 'pending').length;
  const upcomingPreviewCount = items.filter(
    (i) =>
      i.status === 'pending' && timeOfDayToDate(i.scheduledItem.time_of_day, now) <= upcomingCutoff,
  ).length;
  const hasMoreUpcoming = totalUpcomingCount > upcomingPreviewCount;
  let lastUpcomingIndex = -1;
  items.forEach((i, idx) => {
    if (i.status === 'pending') lastUpcomingIndex = idx;
  });

  function isUpcomingHidden(entry: TimelineItem): boolean {
    return (
      !upcomingExpanded &&
      entry.status === 'pending' &&
      timeOfDayToDate(entry.scheduledItem.time_of_day, now) > upcomingCutoff
    );
  }

  // "Mark all as done" sweeps up both overdue items (window still open) and
  // items already flipped to missed — both are incomplete and both can be
  // caught up retroactively; only completed/skipped items are excluded.
  const actionableItems = items
    .filter((i) => i.status === 'overdue' || i.status === 'missed')
    .map((i) => i.scheduledItem);
  const actionableCount = actionableItems.length;

  // Deriving from `items` (rather than trusting selectedIds directly) drops
  // stale selections for items that stopped being actionable, e.g. recorded
  // elsewhere and picked up via the realtime subscription.
  const selectedActionableItems = actionableItems.filter((item) => selectedIds.has(item.id));
  const allActionableSelected =
    actionableItems.length > 0 && selectedActionableItems.length === actionableItems.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedActionableItems.length > 0 && !allActionableSelected;
    }
  }, [selectedActionableItems.length, allActionableSelected]);

  function toggleSelectAll() {
    setSelectedIds(
      allActionableSelected ? new Set() : new Set(actionableItems.map((item) => item.id)),
    );
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {actionableCount > 0 && (
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
              {actionableCount} to catch up
            </div>
          )}
          <button
            type="button"
            onClick={() => setPrnModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#7c3aed',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            As-needed medication
          </button>
        </div>
      </div>

      {actionableCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            borderRadius: 10,
            padding: '10px 16px',
            marginBottom: 12,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 600,
              color: '#4338ca',
            }}
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allActionableSelected}
              onChange={toggleSelectAll}
              aria-label={allActionableSelected ? 'Deselect all items' : 'Select all items'}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            {selectedActionableItems.length > 0
              ? `${selectedActionableItems.length} selected`
              : 'Select all'}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedActionableItems.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={{ ...secondaryBtnStyle, flex: 'none', padding: '7px 14px' }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (selectedActionableItems.length === 0) {
                  setSelectedIds(new Set(actionableItems.map((item) => item.id)));
                }
                setBulkModalOpen(true);
              }}
              style={{ ...primaryBtnStyle('#4338ca'), flex: 'none', padding: '7px 14px' }}
            >
              {selectedActionableItems.length > 0 ? 'Mark selected as done' : 'Mark all as done'}
            </button>
          </div>
        </div>
      )}

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
          {items.map((entry, idx) => {
            const { scheduledItem: item, event, status } = entry;
            const colors = STATUS_COLORS[status];
            const carer = event?.carer_id ? carerMap.get(event.carer_id) : null;
            const recordable = status === 'pending' || status === 'overdue' || status === 'missed';
            const hidden = isUpcomingHidden(entry);

            function handleActivate() {
              if (recordable) {
                if (item.type === 'nutrition') {
                  router.push(`/session/nutrition/${item.id}`);
                } else {
                  setActiveItem(item);
                }
              } else {
                setDetailItem({ item, status });
              }
            }

            return (
              <Fragment key={item.id}>
                {idx === firstUpcomingIndex && <SectionHeader title="Upcoming" />}
                {idx === firstEarlierIndex && <SectionHeader title="Earlier today" />}
                {!hidden && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleActivate}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleActivate();
                      }
                    }}
                    style={{
                      background: colors.bg,
                      border: '1px solid #e5e7eb',
                      borderLeft: `4px solid ${colors.border}`,
                      borderRadius: 10,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                      cursor: 'pointer',
                    }}
                  >
                    {status === 'overdue' || status === 'missed' ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{ flexShrink: 0, paddingTop: 4 }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          aria-label={`Select ${item.name} to mark as done`}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                      </div>
                    ) : (
                      <div style={{ flexShrink: 0, width: 16 }} />
                    )}
                    <div
                      style={{
                        flexShrink: 0,
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: TYPE_CONFIG[item.type].bg,
                      }}
                    >
                      <Icon
                        name={TYPE_CONFIG[item.type].icon}
                        size={16}
                        color={TYPE_CONFIG[item.type].color}
                      />
                    </div>
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
                        {item.type === 'medication_scheduled' && item.is_compulsory && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 20,
                              background: '#fee2e2',
                              color: '#dc2626',
                              flexShrink: 0,
                            }}
                          >
                            Compulsory
                          </span>
                        )}
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
                )}
                {idx === lastUpcomingIndex && hasMoreUpcoming && (
                  <button
                    type="button"
                    onClick={() => setUpcomingExpanded((v) => !v)}
                    style={{
                      alignSelf: 'center',
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '10px 0',
                      cursor: 'pointer',
                    }}
                  >
                    {upcomingExpanded
                      ? 'Show less'
                      : `View all ${totalUpcomingCount} upcoming today`}
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      {activeItem && (
        <RecordItemModal
          item={activeItem}
          careRecipientId={careRecipientId}
          carerId={carerId}
          onClose={() => setActiveItem(null)}
          onRecorded={handleRecorded}
        />
      )}

      {detailItem && (
        <ScheduledItemDetailModal
          item={detailItem.item}
          statusLabel={statusLabel(detailItem.status)}
          statusColor={STATUS_COLORS[detailItem.status].labelText}
          statusBg={STATUS_COLORS[detailItem.status].labelBg}
          onClose={() => setDetailItem(null)}
        />
      )}

      {prnModalOpen && (
        <PRNMedicationModal
          medications={asNeededMedications}
          careRecipientId={careRecipientId}
          carerId={carerId}
          onClose={() => setPrnModalOpen(false)}
          onRecorded={handleRecorded}
        />
      )}

      {bulkModalOpen && selectedActionableItems.length > 0 && (
        <BulkCatchUpModal
          items={selectedActionableItems}
          careRecipientId={careRecipientId}
          carerId={carerId}
          onClose={() => setBulkModalOpen(false)}
          onRecorded={handleBulkRecorded}
        />
      )}
    </div>
  );
}
