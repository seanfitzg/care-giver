import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAbandonNutritionSession,
  useEndNutritionSession,
  useStartNutritionSession,
} from '@/hooks/useNutritionSession';

type Phase = 'bolus' | 'rest';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function NutritionSessionScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { careRecipientId, user } = useAuth();

  const params = useLocalSearchParams<{
    scheduledItemId: string;
    name: string;
    bolusRestMinutes: string;
    bolusRounds: string;
  }>();

  const scheduledItemId = params.scheduledItemId ?? '';
  const sessionName = params.name ?? 'Nutrition Session';
  const bolusRestSeconds = Math.max(1, parseInt(params.bolusRestMinutes ?? '20', 10)) * 60;
  const totalBolus = parseInt(params.bolusRounds ?? '0', 10) || null;

  const { mutateAsync: startSession } = useStartNutritionSession();
  const { mutateAsync: endSession, isPending: isEnding } = useEndNutritionSession();
  const { mutateAsync: abandonSession, isPending: isAbandoning } = useAbandonNutritionSession();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startedAtRef = useRef<Date>(new Date());

  const [phase, setPhase] = useState<Phase>('bolus');
  const [bolusCount, setBolusCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState(bolusRestSeconds);
  const [notes, setNotes] = useState('');
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  const sessionStarted = useRef(false);

  useEffect(() => {
    if (sessionStarted.current || !careRecipientId || !user) return;
    sessionStarted.current = true;
    startedAtRef.current = new Date();

    startSession({
      careRecipientId,
      scheduledItemId,
      carerId: user.id,
      startedAt: startedAtRef.current.toISOString(),
    })
      .then((id) => setSessionId(id))
      .catch((err: Error) => setStartError(err.message));
  }, [careRecipientId, user, scheduledItemId, startSession]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
      if (phase === 'rest') {
        setRestSecondsLeft((r) => {
          if (r <= 1) {
            setPhase('bolus');
            return bolusRestSeconds;
          }
          return r - 1;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, bolusRestSeconds]);

  function handleBolusComplete() {
    setBolusCount((c) => c + 1);
    setRestSecondsLeft(bolusRestSeconds);
    setPhase('rest');
  }

  function handleSkipRest() {
    setPhase('bolus');
    setRestSecondsLeft(bolusRestSeconds);
  }

  async function handleEndSession() {
    if (!sessionId || !careRecipientId || !user) return;
    setEndError(null);
    try {
      await endSession({
        sessionId,
        careRecipientId,
        scheduledItemId,
        carerId: user.id,
        bolusRoundsCompleted: bolusCount,
        notes: notes.trim() || undefined,
        completedAt: new Date().toISOString(),
      });
      router.back();
    } catch {
      setEndError('Failed to save session. Please try again.');
    }
  }

  function handleAbandon() {
    setConfirmAbandon(true);
  }


  async function confirmAbandonSession() {
    setConfirmAbandon(false);
    if (!sessionId || !careRecipientId) {
      router.back();
      return;
    }
    try {
      await abandonSession({
        sessionId,
        careRecipientId,
        bolusRoundsCompleted: bolusCount,
        notes: notes.trim() || undefined,
      });
    } catch {
      // best-effort; navigate back regardless
    }
    router.back();
  }

  const isStarting = sessionId === null && startError === null;
  const isBusy = isStarting || isEnding || isAbandoning;
  const currentBolus = bolusCount + 1;
  const bolusLabel = totalBolus ? `Bolus ${currentBolus} of ${totalBolus}` : `Bolus ${currentBolus}`;

  const contentStyle = isTablet ? styles.contentTablet : styles.content;

  if (startError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not start session: {startError}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={handleAbandon}
          disabled={isEnding || isAbandoning}
        >
          <Text style={[styles.headerBtnText, styles.abandonText]}>Abandon</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {sessionName}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <Modal
        visible={confirmAbandon}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmAbandon(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Abandon session?</Text>
            <Text style={styles.modalBody}>
              The partial session will be recorded. This will not block the next scheduled feed.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setConfirmAbandon(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnAbandon]}
                onPress={confirmAbandonSession}
                disabled={isAbandoning}
              >
                <Text style={styles.modalBtnAbandonText}>
                  {isAbandoning ? 'Saving…' : 'Abandon'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
        {/* Elapsed timer */}
        <View style={styles.elapsedBlock}>
          <Text style={[styles.elapsedTime, isTablet && styles.elapsedTimeTablet]}>
            {formatDuration(elapsedSeconds)}
          </Text>
          <Text style={styles.elapsedLabel}>Total session time</Text>
        </View>

        {/* Phase card */}
        <View style={[styles.phaseCard, phase === 'rest' && styles.phaseCardRest]}>
          {phase === 'bolus' ? (
            <>
              <Text style={styles.phaseLabel}>Current phase</Text>
              <Text style={[styles.phaseName, isTablet && styles.phaseNameTablet]}>
                {bolusLabel}
              </Text>
              {totalBolus && (
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min((bolusCount / totalBolus) * 100, 100)}%` },
                    ]}
                  />
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.phaseLabel}>Rest period</Text>
              <Text style={[styles.restCountdown, isTablet && styles.restCountdownTablet]}>
                {formatDuration(restSecondsLeft)}
              </Text>
              <Text style={styles.restSubLabel}>
                After bolus {bolusCount}
              </Text>
              <Pressable style={styles.skipBtn} onPress={handleSkipRest} disabled={isBusy}>
                <Ionicons name="play-skip-forward-outline" size={16} color="#d97706" />
                <Text style={styles.skipBtnText}>Skip rest</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Notes */}
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.notesInput, isTablet && styles.notesInputTablet]}
            placeholder="e.g. vomited during bolus 2, reduced rate..."
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={isTablet ? 4 : 3}
            textAlignVertical="top"
          />
        </View>

        {/* Actions */}
        {phase === 'bolus' && (
          <Pressable
            style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
            onPress={handleBolusComplete}
            disabled={isBusy}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Bolus complete</Text>
          </Pressable>
        )}

        {endError && <Text style={styles.endErrorText}>{endError}</Text>}

        <Pressable
          style={[styles.endBtn, (isBusy || !sessionId) && styles.btnDisabled]}
          onPress={handleEndSession}
          disabled={isBusy || !sessionId}
        >
          <Text style={styles.endBtnText}>
            {isEnding ? 'Saving...' : isStarting ? 'Starting…' : 'End session'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBtn: { width: 80 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111827' },
  headerBtnText: { fontSize: 15, fontWeight: '500' },
  abandonText: { color: '#dc2626' },

  content: { padding: 20, gap: 16, paddingBottom: 40 },
  contentTablet: { padding: 40, gap: 24, paddingBottom: 60, maxWidth: 600, alignSelf: 'center', width: '100%' },

  elapsedBlock: { alignItems: 'center', paddingVertical: 24 },
  elapsedTime: { fontSize: 52, fontWeight: '200', color: '#111827', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  elapsedTimeTablet: { fontSize: 72 },
  elapsedLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  phaseCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  phaseCardRest: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  phaseLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  phaseName: { fontSize: 28, fontWeight: '700', color: '#1d4ed8' },
  phaseNameTablet: { fontSize: 36 },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#bfdbfe',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  restCountdown: { fontSize: 48, fontWeight: '200', color: '#92400e', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  restCountdownTablet: { fontSize: 64 },
  restSubLabel: { fontSize: 13, color: '#92400e' },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  skipBtnText: { fontSize: 14, fontWeight: '600', color: '#d97706' },

  notesBlock: { gap: 6 },
  notesLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 72,
    backgroundColor: '#fff',
  },
  notesInputTablet: { minHeight: 100, fontSize: 15 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  endBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#16a34a',
    marginTop: 4,
  },
  endBtnText: { fontSize: 16, fontWeight: '700', color: '#16a34a' },

  btnDisabled: { opacity: 0.5 },
  endErrorText: { fontSize: 13, color: '#dc2626', textAlign: 'center', marginTop: 4 },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center' },
  backBtn: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  backBtnText: { fontSize: 15, color: '#374151', fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalBody: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  modalBtnCancel: { backgroundColor: '#f3f4f6' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalBtnAbandon: { backgroundColor: '#dc2626' },
  modalBtnAbandonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
