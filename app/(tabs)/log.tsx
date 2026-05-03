import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType =
  | 'medication_scheduled'
  | 'as_needed_medication'
  | 'feeding'
  | 'activity'
  | 'missed';

type EventStatus = 'completed' | 'missed' | 'skipped';

type EventLogEntry = {
  id: string;
  event_type: EventType;
  scheduled_item_id: string | null;
  carer_id: string | null;
  occurred_at: string;
  status: EventStatus;
  notes: string | null;
  bulk_confirmed: boolean;
  // Joined
  scheduled_item_name: string | null;
  carer_email: string | null;
};

type FeedingSessionEntry = {
  id: string;
  scheduled_item_id: string | null;
  carer_id: string | null;
  started_at: string;
  completed_at: string | null;
  bolus_rounds_completed: number | null;
  notes: string | null;
  bulk_confirmed: boolean;
  // Joined
  scheduled_item_name: string | null;
  carer_email: string | null;
};

type FilterKey = 'all' | 'medication_scheduled' | 'as_needed_medication' | 'feeding' | 'activity' | 'missed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function groupByDate<T extends { occurred_at?: string; started_at?: string }>(
  entries: T[],
): { date: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const entry of entries) {
    const iso = entry.occurred_at ?? entry.started_at ?? '';
    const key = iso.slice(0, 10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([date, items]) => ({ date, items }));
}

function typeIcon(type: EventType): string {
  if (type === 'medication_scheduled' || type === 'as_needed_medication') return '💊';
  if (type === 'feeding') return '🍼';
  if (type === 'activity') return '🏃';
  return '⚠️';
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchEventLog(careRecipientId: string): Promise<EventLogEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase.rpc('get_event_log_with_details', {
    p_care_recipient_id: careRecipientId,
    p_since: since.toISOString(),
    p_until: new Date().toISOString(),
  });
  if (error) throw error;
  return (data ?? []) as EventLogEntry[];
}

async function fetchFeedingSessionLog(careRecipientId: string): Promise<FeedingSessionEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase.rpc('get_feeding_sessions_with_details', {
    p_care_recipient_id: careRecipientId,
    p_since: since.toISOString(),
    p_until: new Date().toISOString(),
  });
  if (error) throw error;
  return (data ?? []) as FeedingSessionEntry[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: EventStatus }) {
  const config: Record<EventStatus, { label: string; bg: string; text: string }> = {
    completed: { label: 'Done', bg: '#d1fae5', text: '#065f46' },
    missed: { label: 'Missed', bg: '#ede9fe', text: '#5b21b6' },
    skipped: { label: 'Skipped', bg: '#f3f4f6', text: '#6b7280' },
  };
  const c = config[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function EventCard({ entry }: { entry: EventLogEntry }) {
  const isMissed = entry.status === 'missed';
  const displayName = entry.scheduled_item_name ?? entry.event_type.replace('_', ' ');

  return (
    <View style={[styles.card, isMissed && styles.cardMissed]}>
      <Text style={styles.cardIcon}>{typeIcon(entry.event_type)}</Text>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{displayName}</Text>
          <StatusPill status={entry.status} />
          {entry.bulk_confirmed && (
            <View style={styles.bulkPill}>
              <Text style={styles.bulkPillText}>Bulk</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardMeta}>
          {formatDateTime(entry.occurred_at)}
          {entry.carer_email ? `  ·  ${entry.carer_email}` : ''}
        </Text>
        {entry.notes ? (
          <Text style={styles.cardNotes} numberOfLines={2}>{entry.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

function FeedingCard({ entry }: { entry: FeedingSessionEntry }) {
  const displayName = entry.scheduled_item_name ?? 'Feeding session';
  const isComplete = !!entry.completed_at;

  return (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>🍼</Text>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{displayName}</Text>
          <View style={[styles.pill, { backgroundColor: isComplete ? '#d1fae5' : '#fef3c7' }]}>
            <Text style={[styles.pillText, { color: isComplete ? '#065f46' : '#92400e' }]}>
              {isComplete ? 'Done' : 'Incomplete'}
            </Text>
          </View>
          {entry.bulk_confirmed && (
            <View style={styles.bulkPill}>
              <Text style={styles.bulkPillText}>Bulk</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardMeta}>
          {formatDateTime(entry.started_at)}
          {entry.carer_email ? `  ·  ${entry.carer_email}` : ''}
          {entry.bolus_rounds_completed != null
            ? `  ·  ${entry.bolus_rounds_completed} bolus round${entry.bolus_rounds_completed !== 1 ? 's' : ''}`
            : ''}
        </Text>
        {entry.notes ? (
          <Text style={styles.cardNotes} numberOfLines={2}>{entry.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

// A merged log entry for display
type MergedEntry =
  | { kind: 'event'; data: EventLogEntry; sortKey: string }
  | { kind: 'feeding'; data: FeedingSessionEntry; sortKey: string };

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LogScreen() {
  const { careRecipientId } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('all');

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'medication_scheduled', label: 'Meds' },
    { key: 'feeding', label: 'Feed' },
    { key: 'activity', label: 'Activity' },
    { key: 'missed', label: 'Missed' },
  ];

  const {
    data: events = [],
    isLoading: loadingEvents,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['event_log', careRecipientId],
    queryFn: () => fetchEventLog(careRecipientId!),
    enabled: !!careRecipientId,
  });

  const {
    data: feedingSessions = [],
    isLoading: loadingFeeds,
    refetch: refetchFeeds,
  } = useQuery({
    queryKey: ['feeding_session_log', careRecipientId],
    queryFn: () => fetchFeedingSessionLog(careRecipientId!),
    enabled: !!careRecipientId,
  });

  const isLoading = loadingEvents || loadingFeeds;

  const refetch = () => { refetchEvents(); refetchFeeds(); };

  // Merge and filter
  const merged: MergedEntry[] = [
    ...events
      .filter(e => {
        if (filter === 'all') return true;
        if (filter === 'missed') return e.status === 'missed';
        return e.event_type === filter;
      })
      .map(e => ({ kind: 'event' as const, data: e, sortKey: e.occurred_at })),
    ...(filter === 'all' || filter === 'feeding'
      ? feedingSessions.map(fs => ({ kind: 'feeding' as const, data: fs, sortKey: fs.started_at }))
      : []),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  // Group by date
  const grouped: { date: string; items: MergedEntry[] }[] = [];
  for (const entry of merged) {
    const dateKey = entry.sortKey.slice(0, 10);
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateKey) {
      last.items.push(entry);
    } else {
      grouped.push({ date: dateKey, items: [entry] });
    }
  }

  // Flatten for FlatList
  type ListRow =
    | { type: 'header'; date: string; id: string }
    | { type: 'entry'; entry: MergedEntry; id: string };

  const listData: ListRow[] = grouped.flatMap(g => [
    { type: 'header' as const, date: g.date, id: `h-${g.date}` },
    ...g.items.map(e => ({ type: 'entry' as const, entry: e, id: e.kind + '-' + e.data.id })),
  ]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={listData}
        keyExtractor={row => row.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No log entries found.</Text>
        }
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return (
              <Text style={styles.dateHeader}>
                {formatDate(row.date + 'T00:00:00')}
              </Text>
            );
          }
          const { entry } = row;
          if (entry.kind === 'event') {
            return <EventCard entry={entry.data} />;
          }
          return <FeedingCard entry={entry.data} />;
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    gap: 6,
    padding: 12,
    paddingBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 10,
  },
  filterBtnActive: { backgroundColor: '#2563eb' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterTextActive: { color: '#fff' },

  // List
  list: { padding: 12, gap: 6, paddingBottom: 40 },
  dateHeader: {
    fontSize: 11, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingVertical: 6, paddingTop: 12,
  },
  emptyText: {
    textAlign: 'center', color: '#9ca3af',
    fontSize: 14, marginTop: 48,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardMissed: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  cardIcon: { fontSize: 18, marginTop: 1 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flexShrink: 1 },
  cardMeta: { fontSize: 12, color: '#9ca3af' },
  cardNotes: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },

  // Pills
  pill: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  bulkPill: { backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  bulkPillText: { fontSize: 10, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
});
