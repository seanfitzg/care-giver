import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduledItemType = 'medication_scheduled' | 'feeding' | 'activity';

type ScheduledItem = {
  id: string;
  type: ScheduledItemType;
  name: string;
  time_of_day: string | null;       // HH:MM:SS
  interval_minutes: number | null;
  overdue_window_minutes: number;
  missed_threshold_minutes: number;
  is_compulsory: boolean;
  bolus_rest_minutes: number | null;
};

type EventLogRow = {
  id: string;
  event_type: string;
  scheduled_item_id: string | null;
  occurred_at: string;
  status: 'completed' | 'missed' | 'skipped';
  notes: string | null;
  bulk_confirmed: boolean;
};

type FeedingSessionRow = {
  id: string;
  scheduled_item_id: string | null;
  started_at: string;
  completed_at: string | null;
  bolus_rounds_completed: number | null;
};

// ─── Derived timeline item ────────────────────────────────────────────────────

type TimelineStatus = 'completed' | 'overdue' | 'upcoming' | 'missed' | 'skipped';

type TimelineItem = {
  key: string;
  item: ScheduledItem;
  dueTime: Date;
  status: TimelineStatus;
  eventId: string | null;
  feedingSessionId: string | null;
  notes: string | null;
  bulkConfirmed: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayAt(timeOfDay: string): Date {
  const [h, m] = timeOfDay.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function typeIcon(type: ScheduledItemType): string {
  if (type === 'medication_scheduled') return '💊';
  if (type === 'feeding') return '🍼';
  return '🏃';
}

function typeLabel(type: ScheduledItemType): string {
  if (type === 'medication_scheduled') return 'Medication';
  if (type === 'feeding') return 'Feed';
  return 'Activity';
}

/**
 * Derive timeline items from scheduled items + today's event log.
 * For feeding items with interval_minutes, we generate one occurrence
 * per interval slot within a 24-hour window starting at midnight.
 */
function buildTimeline(
  items: ScheduledItem[],
  events: EventLogRow[],
  feedingSessions: FeedingSessionRow[],
  now: Date,
): TimelineItem[] {
  const result: TimelineItem[] = [];
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  for (const item of items) {
    if (item.type === 'feeding' && item.interval_minutes) {
      // Generate occurrences for the day
      let dueTime = new Date(startOfDay);
      let slotIndex = 0;
      while (dueTime < new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)) {
        const slotDue = new Date(dueTime);
        const key = `${item.id}-${slotIndex}`;

        // Find a feeding session that started near this slot (within interval/2)
        const halfInterval = (item.interval_minutes * 60 * 1000) / 2;
        const session = feedingSessions.find(
          fs =>
            fs.scheduled_item_id === item.id &&
            Math.abs(new Date(fs.started_at).getTime() - slotDue.getTime()) < halfInterval,
        );

        let status: TimelineStatus;
        if (session?.completed_at) {
          status = 'completed';
        } else if (slotDue <= now) {
          const overdueMs = item.overdue_window_minutes * 60 * 1000;
          const missedMs = item.missed_threshold_minutes * 60 * 1000;
          const age = now.getTime() - slotDue.getTime();
          if (age >= missedMs) status = 'missed';
          else if (age >= overdueMs) status = 'overdue';
          else status = 'upcoming'; // within overdue grace
        } else {
          status = 'upcoming';
        }

        result.push({
          key,
          item,
          dueTime: slotDue,
          status,
          eventId: null,
          feedingSessionId: session?.id ?? null,
          notes: null,
          bulkConfirmed: false,
        });

        dueTime = new Date(dueTime.getTime() + item.interval_minutes * 60 * 1000);
        slotIndex++;
        if (slotIndex > 20) break; // safety
      }
    } else if (item.time_of_day) {
      const dueTime = todayAt(item.time_of_day);
      const event = events.find(e => e.scheduled_item_id === item.id);

      let status: TimelineStatus;
      if (event) {
        status = event.status === 'completed' ? 'completed' : event.status;
      } else if (dueTime <= now) {
        const overdueMs = item.overdue_window_minutes * 60 * 1000;
        const missedMs = item.missed_threshold_minutes * 60 * 1000;
        const age = now.getTime() - dueTime.getTime();
        if (age >= missedMs) status = 'missed';
        else if (age >= overdueMs) status = 'overdue';
        else status = 'upcoming';
      } else {
        status = 'upcoming';
      }

      result.push({
        key: item.id,
        item,
        dueTime,
        status,
        eventId: event?.id ?? null,
        feedingSessionId: null,
        notes: event?.notes ?? null,
        bulkConfirmed: event?.bulk_confirmed ?? false,
      });
    }
  }

  // Sort: overdue first (by dueTime asc), then rest by dueTime
  result.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return a.dueTime.getTime() - b.dueTime.getTime();
  });

  return result;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchScheduledItems(careRecipientId: string): Promise<ScheduledItem[]> {
  const { data, error } = await supabase
    .from('scheduled_items')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .order('time_of_day', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduledItem[];
}

async function fetchTodayEvents(careRecipientId: string): Promise<EventLogRow[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('event_log')
    .select('*')
    .eq('care_recipient_id', careRecipientId)
    .gte('occurred_at', startOfDay.toISOString())
    .lte('occurred_at', endOfDay.toISOString());
  if (error) throw error;
  return (data ?? []) as EventLogRow[];
}

async function fetchTodayFeedingSessions(careRecipientId: string): Promise<FeedingSessionRow[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('feeding_sessions')
    .select('id, scheduled_item_id, started_at, completed_at, bolus_rounds_completed')
    .eq('care_recipient_id', careRecipientId)
    .gte('started_at', startOfDay.toISOString());
  if (error) throw error;
  return (data ?? []) as FeedingSessionRow[];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

async function markItemDone(params: {
  careRecipientId: string;
  userId: string;
  item: ScheduledItem;
  notes: string;
}) {
  const { careRecipientId, userId, item, notes } = params;

  if (item.type === 'feeding') {
    // Create a feeding session record (bulk-style, no guided flow)
    const now = new Date().toISOString();
    const { error } = await supabase.from('feeding_sessions').insert({
      care_recipient_id: careRecipientId,
      scheduled_item_id: item.id,
      carer_id: userId,
      started_at: now,
      completed_at: now,
      notes: notes || null,
      bolus_rounds_completed: null,
      bulk_confirmed: false,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('event_log').insert({
      care_recipient_id: careRecipientId,
      event_type: item.type,
      scheduled_item_id: item.id,
      carer_id: userId,
      occurred_at: new Date().toISOString(),
      status: 'completed',
      notes: notes || null,
      bulk_confirmed: false,
    });
    if (error) throw error;
  }
}

async function bulkCatchUp(params: {
  careRecipientId: string;
  userId: string;
  overdueItems: TimelineItem[];
  notes: string;
}) {
  const { careRecipientId, userId, overdueItems, notes } = params;

  const eventLogRows = overdueItems
    .filter(ti => ti.item.type !== 'feeding')
    .map(ti => ({
      care_recipient_id: careRecipientId,
      event_type: ti.item.type,
      scheduled_item_id: ti.item.id,
      carer_id: userId,
      occurred_at: ti.dueTime.toISOString(),
      status: 'completed' as const,
      notes: notes || null,
      bulk_confirmed: true,
    }));

  const feedingRows = overdueItems
    .filter(ti => ti.item.type === 'feeding')
    .map(ti => ({
      care_recipient_id: careRecipientId,
      scheduled_item_id: ti.item.id,
      carer_id: userId,
      started_at: ti.dueTime.toISOString(),
      completed_at: ti.dueTime.toISOString(),
      notes: notes || null,
      bolus_rounds_completed: null,
      bulk_confirmed: true,
    }));

  if (eventLogRows.length > 0) {
    const { error } = await supabase.from('event_log').insert(eventLogRows);
    if (error) throw error;
  }
  if (feedingRows.length > 0) {
    const { error } = await supabase.from('feeding_sessions').insert(feedingRows);
    if (error) throw error;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: TimelineStatus }) {
  const config: Record<TimelineStatus, { label: string; bg: string; text: string }> = {
    completed: { label: 'Done', bg: '#d1fae5', text: '#065f46' },
    overdue: { label: 'Overdue', bg: '#fee2e2', text: '#991b1b' },
    missed: { label: 'Missed', bg: '#ede9fe', text: '#5b21b6' },
    skipped: { label: 'Skipped', bg: '#fef9c3', text: '#92400e' },
    upcoming: { label: 'Upcoming', bg: '#f3f4f6', text: '#6b7280' },
  };
  const c = config[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function TimelineCard({
  ti,
  onMarkDone,
  onStartFeed,
}: {
  ti: TimelineItem;
  onMarkDone: (ti: TimelineItem) => void;
  onStartFeed: (ti: TimelineItem) => void;
}) {
  const isDone = ti.status === 'completed' || ti.status === 'missed' || ti.status === 'skipped';
  const isOverdue = ti.status === 'overdue';

  return (
    <View style={[
      styles.card,
      isOverdue && styles.cardOverdue,
      (ti.status === 'completed' || ti.status === 'missed') && styles.cardDone,
    ]}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardIcon}>{typeIcon(ti.item.type)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, isDone && styles.cardTitleDone]} numberOfLines={1}>
            {ti.item.name}
          </Text>
          <StatusPill status={ti.status} />
        </View>
        <Text style={styles.cardTime}>
          {formatTime(ti.dueTime)}
          {ti.notes ? `  ·  ${ti.notes}` : ''}
        </Text>
        {ti.bulkConfirmed && (
          <Text style={styles.cardBulk}>Bulk confirmed</Text>
        )}
      </View>
      {!isDone && (
        <View style={styles.cardAction}>
          {ti.item.type === 'feeding' ? (
            <Pressable style={styles.btnPrimary} onPress={() => onStartFeed(ti)}>
              <Text style={styles.btnPrimaryText}>Start</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.btnOutline, isOverdue && styles.btnOutlineOverdue]}
              onPress={() => onMarkDone(ti)}
            >
              <Text style={[styles.btnOutlineText, isOverdue && styles.btnOutlineOverdueText]}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { careRecipientId, user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const now = new Date();

  // Sheet state
  const [confirmItem, setConfirmItem] = useState<TimelineItem | null>(null);
  const [noteText, setNoteText] = useState('');
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [catchUpNote, setCatchUpNote] = useState('');

  // Queries
  const { data: scheduledItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['scheduled_items', careRecipientId],
    queryFn: () => fetchScheduledItems(careRecipientId!),
    enabled: !!careRecipientId,
  });

  const { data: todayEvents = [], isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['today_events', careRecipientId],
    queryFn: () => fetchTodayEvents(careRecipientId!),
    enabled: !!careRecipientId,
    refetchInterval: 60_000, // re-check every minute
  });

  const { data: feedingSessions = [], isLoading: loadingFeeds, refetch: refetchFeeds } = useQuery({
    queryKey: ['today_feeding_sessions', careRecipientId],
    queryFn: () => fetchTodayFeedingSessions(careRecipientId!),
    enabled: !!careRecipientId,
    refetchInterval: 60_000,
  });

  const isLoading = loadingItems || loadingEvents || loadingFeeds;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['today_events', careRecipientId] });
    qc.invalidateQueries({ queryKey: ['today_feeding_sessions', careRecipientId] });
  };

  // Mark done mutation
  const markDoneMutation = useMutation({
    mutationFn: (params: { item: ScheduledItem; notes: string }) =>
      markItemDone({
        careRecipientId: careRecipientId!,
        userId: user!.id,
        item: params.item,
        notes: params.notes,
      }),
    onSuccess: () => {
      invalidate();
      setConfirmItem(null);
      setNoteText('');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  // Bulk catch-up mutation
  const bulkMutation = useMutation({
    mutationFn: (params: { overdueItems: TimelineItem[]; notes: string }) =>
      bulkCatchUp({
        careRecipientId: careRecipientId!,
        userId: user!.id,
        overdueItems: params.overdueItems,
        notes: params.notes,
      }),
    onSuccess: () => {
      invalidate();
      setCatchUpOpen(false);
      setCatchUpNote('');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  // Build timeline
  const timeline = buildTimeline(scheduledItems, todayEvents, feedingSessions, now);
  const overdueItems = timeline.filter(ti => ti.status === 'overdue');

  const handleMarkDone = (ti: TimelineItem) => {
    setConfirmItem(ti);
    setNoteText('');
  };

  const handleStartFeed = (_ti: TimelineItem) => {
    router.push('/(tabs)/feed' as never);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const today = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      {/* Overdue banner */}
      {overdueItems.length > 0 && (
        <View style={styles.overdueBanner}>
          <View style={styles.overdueBannerRow}>
            <Text style={styles.overdueCount}>{overdueItems.length} overdue</Text>
            <Pressable
              style={styles.catchUpButton}
              onPress={() => setCatchUpOpen(true)}
            >
              <Text style={styles.catchUpButtonText}>Catch up all</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Timeline list */}
      <FlatList
        data={timeline}
        keyExtractor={ti => ti.key}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { refetchEvents(); refetchFeeds(); }}
            tintColor="#2563eb"
          />
        }
        ListHeaderComponent={
          <Text style={styles.dateLabel}>{today}</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No scheduled items for today.</Text>
        }
        renderItem={({ item: ti }) => (
          <TimelineCard
            ti={ti}
            onMarkDone={handleMarkDone}
            onStartFeed={handleStartFeed}
          />
        )}
      />

      {/* Mark done bottom sheet */}
      <Modal
        visible={!!confirmItem}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setConfirmItem(null)}
      >
        <View style={styles.sheet}>
          {confirmItem && (
            <>
              <Text style={styles.sheetTitle}>Mark as done</Text>
              <Text style={styles.sheetSubtitle}>
                {typeIcon(confirmItem.item.type)} {confirmItem.item.name}
                {'  ·  '}
                {formatTime(confirmItem.dueTime)}
              </Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (optional)…"
                placeholderTextColor="#9ca3af"
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={3}
              />
              <View style={styles.sheetActions}>
                <Pressable
                  style={styles.sheetCancel}
                  onPress={() => { setConfirmItem(null); setNoteText(''); }}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.sheetConfirm, markDoneMutation.isPending && styles.btnDisabled]}
                  onPress={() => markDoneMutation.mutate({ item: confirmItem.item, notes: noteText })}
                  disabled={markDoneMutation.isPending}
                >
                  {markDoneMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.sheetConfirmText}>Confirm done</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Bulk catch-up bottom sheet */}
      <Modal
        visible={catchUpOpen}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setCatchUpOpen(false)}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Bulk catch-up</Text>
          <Text style={styles.sheetSubtitle}>
            Mark all {overdueItems.length} overdue item{overdueItems.length !== 1 ? 's' : ''} as completed.
          </Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Shared note (optional)… e.g. 'carer present, app not used'"
            placeholderTextColor="#9ca3af"
            value={catchUpNote}
            onChangeText={setCatchUpNote}
            multiline
            numberOfLines={3}
          />
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetCancel} onPress={() => setCatchUpOpen(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetDanger, bulkMutation.isPending && styles.btnDisabled]}
              onPress={() => bulkMutation.mutate({ overdueItems, notes: catchUpNote })}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.sheetConfirmText}>Confirm catch-up</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 8, paddingBottom: 32 },
  dateLabel: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },

  // Overdue banner
  overdueBanner: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  overdueBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overdueCount: { fontSize: 13, fontWeight: '700', color: '#991b1b' },
  catchUpButton: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catchUpButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardOverdue: {
    backgroundColor: '#fff5f5',
    borderColor: '#fecaca',
  },
  cardDone: { opacity: 0.65 },
  cardLeft: { width: 32, alignItems: 'center' },
  cardIcon: { fontSize: 20 },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flexShrink: 1 },
  cardTitleDone: { color: '#6b7280' },
  cardTime: { fontSize: 12, color: '#9ca3af' },
  cardBulk: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  cardAction: { flexShrink: 0 },

  // Buttons
  btnPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnOutline: {
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  btnOutlineText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  btnOutlineOverdue: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  btnOutlineOverdueText: { color: '#2563eb' },
  btnDisabled: { opacity: 0.6 },

  // Status pill
  pill: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Bottom sheet
  sheet: { flex: 1, padding: 24, paddingTop: 32 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  sheetSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  sheetConfirm: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  sheetDanger: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  sheetConfirmText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
