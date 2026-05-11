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
import type { NutritionType } from '@/hooks/useTimeline';

type BolusPhase = 'bolus' | 'rest';
type ScreenState = 'prestart' | 'active';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const ORAL_TYPE_LABELS: Record<string, string> = {
  oral_self: 'Oral feeding (self)',
  oral_carer: 'Oral feeding (carer)',
};

export default function NutritionSessionScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  function goBack() {
    router.replace('/(tabs)');
  }
  const isTablet = width >= 768;
  const { careRecipientId, user } = useAuth();

  const params = useLocalSearchParams<{
    scheduledItemId: string;
    name: string;
    nutritionType: string;
    bolusRestMinutes: string;
  }>();

  const scheduledItemId = params.scheduledItemId ?? '';
  const sessionName = params.name ?? 'Nutrition Session';
  const nutritionType = (params.nutritionType ?? 'bolus') as NutritionType;
  const defaultBolusRestMinutes = Math.max(1, parseInt(params.bolusRestMinutes ?? '20', 10));

  const isBolus = nutritionType === 'bolus';

  // For bolus: start in 'prestart' (carer confirms rest period first).
  // For oral types: go straight to 'active' and start the session on mount.
  const [screenState, setScreenState] = useState<ScreenState>(isBolus ? 'prestart' : 'active');
  const [confirmedRestMinutes, setConfirmedRestMinutes] = useState(String(defaultBolusRestMinutes));

  const bolusRestSeconds = Math.max(1, parseInt(confirmedRestMinutes, 10) || 1) * 60;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startedAtRef = useRef<Date>(new Date());
  const sessionStarted = useRef(false);

  const [phase, setPhase] = useState<BolusPhase>('bolus');
  const [bolusCount, setBolusCount] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState(bolusRestSeconds);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [endConfirmVisible, setEndConfirmVisible] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  const { mutateAsync: startSession } = useStartNutritionSession();
  const { mutateAsync: endSession, isPending: isEnding } = useEndNutritionSession();
  const { mutateAsync: abandonSession, isPending: isAbandoning } = useAbandonNutritionSession();

  // For oral types: start session immediately on mount.
  useEffect(() => {
    if (isBolus) return;
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
  }, [isBolus, careRecipientId, user, scheduledItemId, startSession]);

  // Timer: runs only when session is active.
  useEffect(() => {
    if (screenState !== 'active') return;
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
      if (isBolus && phase === 'rest') {
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
  }, [screenState, isBolus, phase, bolusRestSeconds]);

  async function handleStartBolusSession() {
    if (!careRecipientId || !user || sessionStarted.current) return;
    const restMins = Math.max(1, parseInt(confirmedRestMinutes, 10) || 1);
    sessionStarted.current = true;
    startedAtRef.current = new Date();
    setStartError(null);
    try {
      const id = await startSession({
        careRecipientId,
        scheduledItemId,
        carerId: user.id,
        startedAt: startedAtRef.current.toISOString(),
        bolusRestMinutes: restMins,
      });
      setSessionId(id);
      setRestSecondsLeft(restMins * 60);
      setScreenState('active');
    } catch (err: unknown) {
      sessionStarted.current = false;
      setStartError(err instanceof Error ? err.message : 'Failed to start session');
    }
  }

  function handleBolusComplete() {
    setBolusCount((c) => c + 1);
    setRestSecondsLeft(bolusRestSeconds);
    setPhase('rest');
  }

  function handleSkipRest() {
    setPhase('bolus');
    setRestSecondsLeft(bolusRestSeconds);
  }

  async function handleEndOral() {
    if (!sessionId || !careRecipientId || !user) return;
    setEndError(null);
    try {
      await endSession({
        sessionId,
        careRecipientId,
        scheduledItemId,
        carerId: user.id,
        allConsumed: true,
        notes: notes.trim() || undefined,
        completedAt: new Date().toISOString(),
      });
      goBack();
    } catch (err) {
      console.error('End session error:', err);
      setEndError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleEndBolus(allConsumed: boolean) {
    if (!sessionId || !careRecipientId || !user) return;
    setEndError(null);
    try {
      await endSession({
        sessionId,
        careRecipientId,
        scheduledItemId,
        carerId: user.id,
        allConsumed,
        notes: notes.trim() || undefined,
        completedAt: new Date().toISOString(),
      });
      goBack();
    } catch (err) {
      console.error('End session error:', err);
      setEndConfirmVisible(false);
      setEndError(err instanceof Error ? err.message : String(err));
    }
  }

  async function confirmAbandonSession() {
    setConfirmAbandon(false);
    if (!sessionId || !careRecipientId) {
      goBack();
      return;
    }
    try {
      await abandonSession({
        sessionId,
        careRecipientId,
        notes: notes.trim() || undefined,
      });
    } catch {
      // best-effort; navigate back regardless
    }
    goBack();
  }

  const contentStyle = isTablet ? styles.contentTablet : styles.content;

  if (startError && screenState !== 'prestart') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not start session: {startError}</Text>
        <Pressable style={styles.backBtn} onPress={() => goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Bolus prestart: carer confirms rest period ──────────────────────────
  if (screenState === 'prestart') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => goBack()}>
            <Text style={styles.headerBtnText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {sessionName}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <View style={styles.prestartCard}>
            <Text style={styles.prestartTitle}>Set rest period</Text>
            <Text style={styles.prestartBody}>How long should the rest be between boluses?</Text>
            <View style={styles.restInputRow}>
              <TextInput
                style={[styles.restInput, isTablet && styles.restInputTablet]}
                value={confirmedRestMinutes}
                onChangeText={setConfirmedRestMinutes}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={3}
              />
              <Text style={styles.restInputUnit}>minutes</Text>
            </View>
          </View>

          {startError ? <Text style={styles.endErrorText}>{startError}</Text> : null}

          <Pressable style={styles.primaryBtn} onPress={handleStartBolusSession}>
            <Ionicons name="play-circle-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Start session</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Active session ──────────────────────────────────────────────────────
  const isStarting = sessionId === null && startError === null && !isBolus;
  const isBusy = isStarting || isEnding || isAbandoning;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => setConfirmAbandon(true)}
          disabled={isEnding || isAbandoning}
        >
          <Text style={[styles.headerBtnText, styles.abandonText]}>Abandon</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {sessionName}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Abandon confirmation modal */}
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

      {/* Bolus end-session confirmation modal */}
      <Modal
        visible={endConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEndConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End session</Text>
            <Text style={styles.modalBody}>Was all nutrition consumed?</Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnNo]}
                onPress={() => handleEndBolus(false)}
                disabled={isEnding}
              >
                <Text style={styles.modalBtnNoText}>{isEnding ? 'Saving…' : 'No'}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnYes]}
                onPress={() => handleEndBolus(true)}
                disabled={isEnding}
              >
                <Text style={styles.modalBtnYesText}>{isEnding ? 'Saving…' : 'Yes'}</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.modalCancelLink}
              onPress={() => setEndConfirmVisible(false)}
              disabled={isEnding}
            >
              <Text style={styles.modalCancelLinkText}>Back to session</Text>
            </Pressable>
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

        {isBolus ? (
          <>
            {/* Bolus phase card */}
            <View style={[styles.phaseCard, phase === 'rest' && styles.phaseCardRest]}>
              {phase === 'bolus' ? (
                <>
                  <Text style={styles.phaseLabel}>Current phase</Text>
                  <Text style={[styles.phaseName, isTablet && styles.phaseNameTablet]}>
                    {`Bolus ${bolusCount + 1}`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.phaseLabel}>Rest period</Text>
                  <Text style={[styles.restCountdown, isTablet && styles.restCountdownTablet]}>
                    {formatDuration(restSecondsLeft)}
                  </Text>
                  <Text style={styles.restSubLabel}>After bolus {bolusCount}</Text>
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
              onPress={() => setEndConfirmVisible(true)}
              disabled={isBusy || !sessionId}
            >
              <Text style={styles.endBtnText}>{isEnding ? 'Saving...' : 'End session'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Oral session */}
            <View style={styles.oralCard}>
              <Text style={styles.phaseLabel}>Session in progress</Text>
              <Text style={[styles.oralTypeLabel, isTablet && styles.oralTypeLabelTablet]}>
                {ORAL_TYPE_LABELS[nutritionType] ?? 'Oral feeding'}
              </Text>
            </View>

            {/* Notes */}
            <View style={styles.notesBlock}>
              <Text style={styles.notesLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.notesInput, isTablet && styles.notesInputTablet]}
                placeholder="e.g. ate well, took 15 minutes..."
                placeholderTextColor="#9ca3af"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={isTablet ? 4 : 3}
                textAlignVertical="top"
              />
            </View>

            {endError && <Text style={styles.endErrorText}>{endError}</Text>}

            <Pressable
              style={[styles.primaryBtn, (isBusy || !sessionId) && styles.btnDisabled]}
              onPress={handleEndOral}
              disabled={isBusy || !sessionId}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>
                {isEnding ? 'Saving...' : isStarting ? 'Starting…' : 'Done'}
              </Text>
            </Pressable>
          </>
        )}
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
  headerBtnText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  abandonText: { color: '#dc2626' },

  content: { padding: 20, gap: 16, paddingBottom: 40 },
  contentTablet: {
    padding: 40,
    gap: 24,
    paddingBottom: 60,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },

  // ── Prestart ────────────────────────────────────────────────────────────
  prestartCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 16,
  },
  prestartTitle: { fontSize: 18, fontWeight: '700', color: '#1d4ed8' },
  prestartBody: { fontSize: 14, color: '#374151', textAlign: 'center' },
  restInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  restInput: {
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 28,
    fontWeight: '700',
    color: '#1d4ed8',
    textAlign: 'center',
    width: 90,
    backgroundColor: '#fff',
  },
  restInputTablet: { fontSize: 36, width: 110 },
  restInputUnit: { fontSize: 16, color: '#374151', fontWeight: '500' },

  // ── Elapsed timer ───────────────────────────────────────────────────────
  elapsedBlock: { alignItems: 'center', paddingVertical: 24 },
  elapsedTime: {
    fontSize: 52,
    fontWeight: '200',
    color: '#111827',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  elapsedTimeTablet: { fontSize: 72 },
  elapsedLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  // ── Bolus phase card ────────────────────────────────────────────────────
  phaseCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  phaseCardRest: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phaseName: { fontSize: 28, fontWeight: '700', color: '#1d4ed8' },
  phaseNameTablet: { fontSize: 36 },
  restCountdown: {
    fontSize: 48,
    fontWeight: '200',
    color: '#92400e',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
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

  // ── Oral card ───────────────────────────────────────────────────────────
  oralCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  oralTypeLabel: { fontSize: 22, fontWeight: '700', color: '#15803d' },
  oralTypeLabelTablet: { fontSize: 28 },

  // ── Notes ───────────────────────────────────────────────────────────────
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

  // ── Buttons ─────────────────────────────────────────────────────────────
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

  // ── Error screen ────────────────────────────────────────────────────────
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center' },
  backBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtnText: { fontSize: 15, color: '#374151', fontWeight: '600' },

  // ── Modals ──────────────────────────────────────────────────────────────
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
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  modalBtnCancel: { backgroundColor: '#f3f4f6' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalBtnAbandon: { backgroundColor: '#dc2626' },
  modalBtnAbandonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  modalBtnNo: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5' },
  modalBtnNoText: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
  modalBtnYes: { backgroundColor: '#16a34a' },
  modalBtnYesText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  modalCancelLink: { alignItems: 'center', paddingVertical: 4 },
  modalCancelLinkText: { fontSize: 13, color: '#6b7280' },
});
