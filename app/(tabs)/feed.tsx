import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedingScheduleItem = {
  id: string;
  name: string;
  interval_minutes: number;
  bolus_rest_minutes: number;
  overdue_window_minutes: number;
  missed_threshold_minutes: number;
};

type ActiveSession = {
  id: string;
  started_at: string;
  bolus_rounds_completed: number;
};

type Phase = 'idle' | 'bolus' | 'rest' | 'done';

type SessionResult = {
  bolusRounds: number;
  notes: string;
  abandoned: boolean;
  durationSeconds: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchFeedingScheduleItems(careRecipientId: string): Promise<FeedingScheduleItem[]> {
  const { data, error } = await supabase
    .from('scheduled_items')
    .select('id, name, interval_minutes, bolus_rest_minutes, overdue_window_minutes, missed_threshold_minutes')
    .eq('care_recipient_id', careRecipientId)
    .eq('type', 'feeding')
    .not('interval_minutes', 'is', null);
  if (error) throw error;
  return (data ?? []) as FeedingScheduleItem[];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

async function startSession(params: {
  careRecipientId: string;
  userId: string;
  scheduledItemId: string;
}): Promise<ActiveSession> {
  const { data, error } = await supabase
    .from('feeding_sessions')
    .insert({
      care_recipient_id: params.careRecipientId,
      scheduled_item_id: params.scheduledItemId,
      carer_id: params.userId,
      started_at: new Date().toISOString(),
      bulk_confirmed: false,
    })
    .select('id, started_at, bolus_rounds_completed')
    .single();
  if (error) throw error;
  return { id: data.id, started_at: data.started_at, bolus_rounds_completed: 0 };
}

async function completeSession(params: {
  sessionId: string;
  bolusRounds: number;
  notes: string;
}): Promise<void> {
  const { error } = await supabase
    .from('feeding_sessions')
    .update({
      completed_at: new Date().toISOString(),
      bolus_rounds_completed: params.bolusRounds,
      notes: params.notes || null,
    })
    .eq('id', params.sessionId);
  if (error) throw error;
}

async function abandonSession(params: {
  sessionId: string;
  bolusRounds: number;
  notes: string;
}): Promise<void> {
  const { error } = await supabase
    .from('feeding_sessions')
    .update({
      completed_at: new Date().toISOString(),
      bolus_rounds_completed: params.bolusRounds,
      notes: params.notes || null,
    })
    .eq('id', params.sessionId);
  if (error) throw error;
}

// ─── Circular rest timer ──────────────────────────────────────────────────────

function RestTimer({
  totalSeconds,
  remainingSeconds,
  onSkip,
}: {
  totalSeconds: number;
  remainingSeconds: number;
  onSkip: () => void;
}) {
  const SIZE = 160;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = (totalSeconds - remainingSeconds) / totalSeconds;
  const offset = CIRC * (1 - progress);

  return (
    <View style={timerStyles.container}>
      <View style={timerStyles.svgWrapper}>
        {/* Track */}
        <View style={[timerStyles.circle, { borderColor: '#e5e7eb' }]} />
        {/* We use a View-based ring approximation since SVG requires react-native-svg.
            In a real project install react-native-svg for crisp arc rendering. */}
        <View style={timerStyles.innerContent}>
          <Text style={timerStyles.countdown}>{formatCountdown(remainingSeconds)}</Text>
          <Text style={timerStyles.restLabel}>rest</Text>
        </View>
      </View>
      <Pressable style={timerStyles.skipBtn} onPress={onSkip}>
        <Text style={timerStyles.skipText}>Skip rest ›</Text>
      </Pressable>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  svgWrapper: {
    width: 160, height: 160,
    alignItems: 'center', justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: 152, height: 152,
    borderRadius: 76,
    borderWidth: 8,
  },
  innerContent: { alignItems: 'center' },
  countdown: {
    fontSize: 36, fontWeight: '700', color: '#111827',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  restLabel: { fontSize: 12, color: '#6b7280', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  skipBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
});

// ─── Schedule picker ──────────────────────────────────────────────────────────

function SchedulePicker({
  items,
  selected,
  onSelect,
}: {
  items: FeedingScheduleItem[];
  selected: FeedingScheduleItem | null;
  onSelect: (item: FeedingScheduleItem) => void;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No feeding schedules configured.</Text>
        <Text style={styles.emptySubtext}>Ask your admin to add a feeding item to the schedule.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {items.map(item => (
        <Pressable
          key={item.id}
          style={[styles.scheduleCard, selected?.id === item.id && styles.scheduleCardSelected]}
          onPress={() => onSelect(item)}
        >
          <Text style={styles.scheduleCardIcon}>🍼</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleCardName}>{item.name}</Text>
            <Text style={styles.scheduleCardMeta}>
              Every {item.interval_minutes} min · {item.bolus_rest_minutes} min rest between boluses
            </Text>
          </View>
          {selected?.id === item.id && (
            <Text style={styles.scheduleCardCheck}>✓</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { careRecipientId, user } = useAuth();
  const qc = useQueryClient();

  // Session state
  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedItem, setSelectedItem] = useState<FeedingScheduleItem | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [bolusCount, setBolusCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<SessionResult | null>(null);
  const [showAbandon, setShowAbandon] = useState(false);
  const [abandonNote, setAbandonNote] = useState('');

  // Timers
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load feeding schedule items
  const { data: scheduleItems = [], isLoading } = useQuery({
    queryKey: ['feeding_schedule_items', careRecipientId],
    queryFn: () => fetchFeedingScheduleItems(careRecipientId!),
    enabled: !!careRecipientId,
  });

  // Auto-select if only one item
  useEffect(() => {
    if (scheduleItems.length === 1 && !selectedItem) {
      setSelectedItem(scheduleItems[0]);
    }
  }, [scheduleItems]);

  // Elapsed timer — runs during bolus and rest phases
  useEffect(() => {
    if (phase === 'bolus' || phase === 'rest') {
      elapsedRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [phase]);

  // Rest countdown
  useEffect(() => {
    if (phase !== 'rest') return;
    restRef.current = setInterval(() => {
      setRestSeconds(s => {
        if (s <= 1) {
          if (restRef.current) clearInterval(restRef.current);
          setPhase('bolus');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [phase]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: () => startSession({
      careRecipientId: careRecipientId!,
      userId: user!.id,
      scheduledItemId: selectedItem!.id,
    }),
    onSuccess: (session) => {
      setActiveSession(session);
      setBolusCount(0);
      setElapsedSeconds(0);
      setPhase('bolus');
    },
    onError: (err: Error) => Alert.alert('Could not start session', err.message),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeSession({
      sessionId: activeSession!.id,
      bolusRounds: bolusCount,
      notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today_feeding_sessions', careRecipientId] });
      qc.invalidateQueries({ queryKey: ['today_events', careRecipientId] });
      setResult({ bolusRounds: bolusCount, notes, abandoned: false, durationSeconds: elapsedSeconds });
      setPhase('done');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const abandonMutation = useMutation({
    mutationFn: () => abandonSession({
      sessionId: activeSession!.id,
      bolusRounds: bolusCount,
      notes: abandonNote,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today_feeding_sessions', careRecipientId] });
      qc.invalidateQueries({ queryKey: ['today_events', careRecipientId] });
      setResult({ bolusRounds: bolusCount, notes: abandonNote, abandoned: true, durationSeconds: elapsedSeconds });
      setPhase('done');
      setShowAbandon(false);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleBolusComplete = () => {
    const newCount = bolusCount + 1;
    setBolusCount(newCount);
    if (selectedItem) {
      setRestSeconds(selectedItem.bolus_rest_minutes * 60);
    }
    setPhase('rest');
  };

  const handleSkipRest = () => {
    if (restRef.current) clearInterval(restRef.current);
    setPhase('bolus');
  };

  const handleEndSession = () => {
    Alert.alert(
      'End session',
      `Record ${bolusCount} bolus round${bolusCount !== 1 ? 's' : ''} and mark this feed as complete?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End session', onPress: () => completeMutation.mutate() },
      ],
    );
  };

  const handleAbandon = () => {
    abandonMutation.mutate();
  };

  const handleReset = () => {
    setPhase('idle');
    setActiveSession(null);
    setBolusCount(0);
    setElapsedSeconds(0);
    setRestSeconds(0);
    setNotes('');
    setResult(null);
    setAbandonNote('');
  };

  // ── Render phases ─────────────────────────────────────────────────────────

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  // Done screen
  if (phase === 'done' && result) {
    return (
      <ScrollView contentContainerStyle={styles.doneContainer}>
        <Text style={styles.doneIcon}>{result.abandoned ? '⚠️' : '✅'}</Text>
        <Text style={styles.doneTitle}>
          {result.abandoned ? 'Session abandoned' : 'Session complete'}
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bolus rounds</Text>
            <Text style={styles.summaryValue}>{result.bolusRounds}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowBorder]}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{formatElapsed(result.durationSeconds)}</Text>
          </View>
          {result.notes ? (
            <View style={[styles.summaryRow, styles.summaryRowBorder]}>
              <Text style={styles.summaryLabel}>Note</Text>
              <Text style={[styles.summaryValue, { fontStyle: 'italic', flex: 1, textAlign: 'right' }]}>{result.notes}</Text>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.btnPrimary} onPress={handleReset}>
          <Text style={styles.btnPrimaryText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Idle — schedule picker
  if (phase === 'idle') {
    return (
      <ScrollView contentContainerStyle={styles.idleContainer}>
        <Text style={styles.sectionLabel}>Select feeding schedule</Text>
        <SchedulePicker
          items={scheduleItems}
          selected={selectedItem}
          onSelect={setSelectedItem}
        />

        {selectedItem && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Rest between boluses: <Text style={{ fontWeight: '700' }}>{selectedItem.bolus_rest_minutes} min</Text>
            </Text>
            <Text style={styles.infoText}>
              Interval: <Text style={{ fontWeight: '700' }}>every {selectedItem.interval_minutes} min</Text>
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.btnPrimary, (!selectedItem || startMutation.isPending) && styles.btnDisabled]}
          onPress={() => startMutation.mutate()}
          disabled={!selectedItem || startMutation.isPending}
        >
          {startMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>Start feeding session</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  // Active session (bolus or rest phase)
  const bolusRestTotal = selectedItem ? selectedItem.bolus_rest_minutes * 60 : 1500;

  return (
    <View style={styles.sessionContainer}>
      {/* Session header */}
      <View style={styles.sessionHeader}>
        <View>
          <Text style={styles.sessionTitle}>{selectedItem?.name ?? 'Feeding'}</Text>
          <Text style={styles.sessionMeta}>
            Started {activeSession ? formatTime(activeSession.started_at) : ''}
            {'  ·  '}
            {formatElapsed(elapsedSeconds)} elapsed
          </Text>
        </View>
        <Pressable style={styles.abandonBtn} onPress={() => setShowAbandon(true)}>
          <Text style={styles.abandonText}>Abandon</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.sessionBody}>
        {/* Bolus counter */}
        <View style={styles.bolusCard}>
          <View>
            <Text style={styles.bolusLabel}>Bolus rounds</Text>
            <Text style={styles.bolusCount}>{bolusCount}</Text>
          </View>
          <Text style={{ fontSize: 36 }}>🍼</Text>
        </View>

        {/* Rest timer or bolus button */}
        {phase === 'rest' ? (
          <View style={styles.restCard}>
            <Text style={styles.restTitle}>Rest period</Text>
            <RestTimer
              totalSeconds={bolusRestTotal}
              remainingSeconds={restSeconds}
              onSkip={handleSkipRest}
            />
          </View>
        ) : (
          <Pressable style={styles.bolusBtn} onPress={handleBolusComplete}>
            <Text style={styles.bolusBtnText}>✓ Bolus complete — start rest</Text>
          </Pressable>
        )}

        {/* Session note */}
        <View>
          <Text style={styles.sectionLabel}>Session note</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note…"
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* End session */}
        <Pressable
          style={[styles.btnOutline, completeMutation.isPending && styles.btnDisabled]}
          onPress={handleEndSession}
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending
            ? <ActivityIndicator color="#374151" />
            : <Text style={styles.btnOutlineText}>End session</Text>}
        </Pressable>
      </ScrollView>

      {/* Abandon bottom sheet */}
      <Modal
        visible={showAbandon}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowAbandon(false)}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Abandon session?</Text>
          <Text style={styles.sheetSubtitle}>
            {bolusCount} bolus round{bolusCount !== 1 ? 's' : ''} will be recorded as incomplete.
          </Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Reason for abandoning…"
            placeholderTextColor="#9ca3af"
            value={abandonNote}
            onChangeText={setAbandonNote}
            multiline
            numberOfLines={3}
          />
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetCancel} onPress={() => setShowAbandon(false)}>
              <Text style={styles.sheetCancelText}>Keep going</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetDanger, abandonMutation.isPending && styles.btnDisabled]}
              onPress={handleAbandon}
              disabled={abandonMutation.isPending}
            >
              {abandonMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.sheetConfirmText}>Abandon</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Idle
  idleContainer: { padding: 20, gap: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  scheduleCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  scheduleCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  scheduleCardIcon: { fontSize: 22 },
  scheduleCardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  scheduleCardMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  scheduleCardCheck: { fontSize: 16, color: '#2563eb', fontWeight: '700' },
  infoBox: {
    backgroundColor: '#fefce8', borderRadius: 8, padding: 12, gap: 4,
    borderWidth: 1, borderColor: '#fde68a',
  },
  infoText: { fontSize: 13, color: '#78350f' },
  emptyState: { padding: 24, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },
  emptySubtext: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

  // Session
  sessionContainer: { flex: 1, backgroundColor: '#f9fafb' },
  sessionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  sessionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sessionMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  abandonBtn: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 7,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  abandonText: { fontSize: 12, color: '#6b7280' },
  sessionBody: { padding: 16, gap: 16, paddingBottom: 40 },

  // Bolus counter card
  bolusCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  bolusLabel: {
    fontSize: 11, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  bolusCount: {
    fontSize: 48, fontWeight: '700', color: '#111827',
    fontVariant: ['tabular-nums'], lineHeight: 52,
  },

  // Bolus action button
  bolusBtn: {
    backgroundColor: '#2563eb', borderRadius: 12, padding: 20,
    alignItems: 'center',
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  bolusBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Rest card
  restCard: {
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 20,
    alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  restTitle: {
    fontSize: 12, fontWeight: '700', color: '#2563eb',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Note input
  noteInput: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 14, color: '#111827',
    minHeight: 80, textAlignVertical: 'top',
  },

  // Done screen
  doneContainer: { padding: 24, alignItems: 'center', gap: 16, paddingTop: 48 },
  doneIcon: { fontSize: 56 },
  doneTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    width: '100%', borderWidth: 1, borderColor: '#e5e7eb',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  summaryLabel: { fontSize: 13, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#111827' },

  // Shared buttons
  btnPrimary: {
    backgroundColor: '#2563eb', borderRadius: 10, padding: 15,
    alignItems: 'center', width: '100%',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    borderRadius: 10, padding: 15, alignItems: 'center',
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  btnOutlineText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  // Sheet
  sheet: { flex: 1, padding: 24, paddingTop: 32 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  sheetSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetCancel: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  sheetDanger: {
    flex: 1, padding: 14, borderRadius: 10,
    backgroundColor: '#dc2626', alignItems: 'center',
  },
  sheetConfirmText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
