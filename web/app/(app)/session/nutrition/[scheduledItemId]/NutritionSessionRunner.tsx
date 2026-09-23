'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/app/(app)/components/Modal';
import {
  primaryBtnStyle,
  secondaryBtnStyle,
  textareaStyle,
} from '@/app/(app)/components/modalStyles';
import type { NutritionSession, NutritionType } from '@/app/(app)/components/types';

const SESSION_COLUMNS =
  'id, care_recipient_id, scheduled_item_id, carer_id, started_at, completed_at, all_consumed, notes, bolus_rest_minutes, bolus_rounds_completed, rest_started_at';

const ACCENT = '#d97706';
const ACCENT_BG = '#fffbeb';
const ACCENT_BORDER = '#fde68a';

const ORAL_TYPE_LABELS: Record<string, string> = {
  oral_self: 'Oral feeding (self)',
  oral_carer: 'Oral feeding (carer)',
};

interface ScheduledItemDetails {
  id: string;
  name: string;
  description: string | null;
  nutrition_type: NutritionType | null;
  bolus_rest_minutes: number | null;
}

interface Props {
  scheduledItem: ScheduledItemDetails;
  careRecipientId: string;
  carerId: string;
  existingSession: NutritionSession | null;
  serverTimeISO: string;
}

function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function clearRestStartedAt(sessionId: string) {
  const supabase = createClient();
  await supabase.from('nutrition_sessions').update({ rest_started_at: null }).eq('id', sessionId);
}

export default function NutritionSessionRunner({
  scheduledItem,
  careRecipientId,
  carerId,
  existingSession,
  serverTimeISO,
}: Props) {
  const router = useRouter();
  const abandonTitleId = useId();
  const endTitleId = useId();

  const nutritionType = scheduledItem.nutrition_type ?? 'bolus';
  const isBolus = nutritionType === 'bolus';
  const defaultBolusRestMinutes = Math.max(1, scheduledItem.bolus_rest_minutes ?? 20);

  const [session, setSession] = useState<NutritionSession | null>(existingSession);
  const [screenState, setScreenState] = useState<'prestart' | 'active'>(
    isBolus && !existingSession ? 'prestart' : 'active',
  );
  const [confirmedRestMinutes, setConfirmedRestMinutes] = useState(
    String(existingSession?.bolus_rest_minutes ?? defaultBolusRestMinutes),
  );

  const [phase, setPhase] = useState<'bolus' | 'rest'>(() =>
    existingSession?.rest_started_at ? 'rest' : 'bolus',
  );
  const [restStartedAt, setRestStartedAt] = useState<Date | null>(() =>
    existingSession?.rest_started_at ? new Date(existingSession.rest_started_at) : null,
  );
  const [bolusRoundsCompleted, setBolusRoundsCompleted] = useState(
    existingSession?.bolus_rounds_completed ?? 0,
  );

  const [now, setNow] = useState(() => new Date(serverTimeISO));
  const [notes, setNotes] = useState(existingSession?.notes ?? '');

  const [startingBolus, setStartingBolus] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  const sessionStartedRef = useRef(existingSession !== null || isBolus);

  const isStarting = session === null && startError === null && !isBolus;
  const busy = isStarting || ending || abandoning;

  const configuredRestMinutes = session?.bolus_rest_minutes ?? defaultBolusRestMinutes;
  const bolusRestSeconds = Math.max(1, configuredRestMinutes) * 60;
  const elapsedSeconds = session
    ? Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000)
    : 0;
  const restSecondsLeft =
    phase === 'rest' && restStartedAt
      ? Math.max(0, bolusRestSeconds - Math.floor((now.getTime() - restStartedAt.getTime()) / 1000))
      : bolusRestSeconds;

  // Oral sessions have no prestart step — create the session row as soon as the
  // page mounts (unless we're resuming one that already exists).
  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    const supabase = createClient();
    supabase
      .from('nutrition_sessions')
      .insert({
        care_recipient_id: careRecipientId,
        scheduled_item_id: scheduledItem.id,
        carer_id: carerId,
        started_at: new Date().toISOString(),
      })
      .select(SESSION_COLUMNS)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setStartError(error?.message ?? 'Failed to start session');
          return;
        }
        setSession(data as NutritionSession);
      });
  }, [careRecipientId, carerId, scheduledItem.id]);

  // Elapsed/rest clock. Deferred initial correction avoids setting state
  // synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (screenState !== 'active' || !session) return;
    const tick = () => {
      const nowDate = new Date();
      setNow(nowDate);
      if (phase === 'rest' && restStartedAt) {
        const remaining =
          bolusRestSeconds - Math.floor((nowDate.getTime() - restStartedAt.getTime()) / 1000);
        if (remaining <= 0) {
          setPhase('bolus');
          setRestStartedAt(null);
          void clearRestStartedAt(session.id);
        }
      }
    };
    const correctionId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);
    return () => {
      clearTimeout(correctionId);
      clearInterval(intervalId);
    };
  }, [screenState, session, phase, restStartedAt, bolusRestSeconds]);

  // Reflect session state in the tab title so carers can monitor it in the background.
  useEffect(() => {
    const originalTitle = document.title;
    return () => {
      document.title = originalTitle;
    };
  }, []);

  useEffect(() => {
    if (screenState !== 'active' || !session) return;
    if (isBolus) {
      document.title =
        phase === 'rest'
          ? `Rest ${formatDuration(restSecondsLeft)} · ${scheduledItem.name}`
          : `Bolus ${bolusRoundsCompleted + 1} · ${scheduledItem.name}`;
    } else {
      document.title = `${formatDuration(elapsedSeconds)} · ${scheduledItem.name}`;
    }
  }, [
    screenState,
    session,
    isBolus,
    phase,
    restSecondsLeft,
    bolusRoundsCompleted,
    elapsedSeconds,
    scheduledItem.name,
  ]);

  async function handleStartBolusSession() {
    if (session || startingBolus) return;
    const restMins = Math.max(1, parseInt(confirmedRestMinutes, 10) || 1);
    setStartingBolus(true);
    setStartError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('nutrition_sessions')
      .insert({
        care_recipient_id: careRecipientId,
        scheduled_item_id: scheduledItem.id,
        carer_id: carerId,
        started_at: new Date().toISOString(),
        bolus_rest_minutes: restMins,
        bolus_rounds_completed: 0,
      })
      .select(SESSION_COLUMNS)
      .single();
    setStartingBolus(false);
    if (error || !data) {
      setStartError(error?.message ?? 'Failed to start session');
      return;
    }
    setSession(data as NutritionSession);
    setScreenState('active');
  }

  async function handleBolusComplete() {
    if (!session || busy) return;
    const restStart = new Date();
    const newCount = bolusRoundsCompleted + 1;
    setPhase('rest');
    setRestStartedAt(restStart);
    setBolusRoundsCompleted(newCount);
    const supabase = createClient();
    await supabase
      .from('nutrition_sessions')
      .update({ bolus_rounds_completed: newCount, rest_started_at: restStart.toISOString() })
      .eq('id', session.id);
  }

  async function handleSkipRest() {
    if (!session) return;
    setPhase('bolus');
    setRestStartedAt(null);
    const supabase = createClient();
    await supabase
      .from('nutrition_sessions')
      .update({ rest_started_at: null })
      .eq('id', session.id);
  }

  async function handleEnd(allConsumed: boolean) {
    if (!session) return;
    setEnding(true);
    setEndError(null);
    const supabase = createClient();
    const completedAt = new Date().toISOString();
    const [sessionResult, logResult] = await Promise.all([
      supabase
        .from('nutrition_sessions')
        .update({
          completed_at: completedAt,
          all_consumed: allConsumed,
          notes: notes.trim() || null,
        })
        .eq('id', session.id),
      supabase.from('event_log').insert({
        care_recipient_id: careRecipientId,
        event_type: 'nutrition',
        scheduled_item_id: scheduledItem.id,
        carer_id: carerId,
        occurred_at: completedAt,
        status: 'completed',
      }),
    ]);
    if (sessionResult.error || logResult.error) {
      setEnding(false);
      setEndConfirmOpen(false);
      setEndError('Could not end session — please try again.');
      return;
    }
    router.push('/');
  }

  async function handleAbandonConfirm() {
    setAbandonConfirmOpen(false);
    if (!session) {
      router.push('/');
      return;
    }
    setAbandoning(true);
    const supabase = createClient();
    try {
      await supabase
        .from('nutrition_sessions')
        .update({ notes: notes.trim() || null })
        .eq('id', session.id);
    } finally {
      router.push('/');
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 560,
    margin: '0 auto',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
  };

  if (startError && screenState === 'active' && !session) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
          Could not start session: {startError}
        </p>
        <button type="button" onClick={() => router.push('/')} style={secondaryBtnStyle}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT, marginBottom: 4 }}>
            Nutrition session
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
            {scheduledItem.name}
          </h1>
        </div>
        {screenState === 'active' && (
          <button
            type="button"
            onClick={() => setAbandonConfirmOpen(true)}
            disabled={ending || abandoning}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 4px',
            }}
          >
            Abandon
          </button>
        )}
      </div>

      {scheduledItem.description && (
        <div
          style={{
            background: ACCENT_BG,
            border: `1px solid ${ACCENT_BORDER}`,
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
            fontSize: 13.5,
            color: '#92400e',
            lineHeight: 1.5,
          }}
        >
          {scheduledItem.description}
        </div>
      )}

      {screenState === 'prestart' && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 14,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>
            Set rest period
          </div>
          <p style={{ fontSize: 13.5, color: '#374151', marginBottom: 16 }}>
            How long should the rest be between boluses?
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 18,
            }}
          >
            <input
              type="number"
              min={1}
              max={999}
              value={confirmedRestMinutes}
              onChange={(e) => setConfirmedRestMinutes(e.target.value)}
              style={{
                width: 90,
                textAlign: 'center',
                fontSize: 26,
                fontWeight: 700,
                color: '#1d4ed8',
                border: '2px solid #2563eb',
                borderRadius: 10,
                padding: '8px 10px',
              }}
            />
            <span style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>minutes</span>
          </div>
          {startError && (
            <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{startError}</p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => router.push('/')}
              disabled={startingBolus}
              style={{ ...secondaryBtnStyle, flex: 1, opacity: startingBolus ? 0.7 : 1 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartBolusSession}
              disabled={startingBolus}
              style={{
                ...primaryBtnStyle('#2563eb'),
                flex: 1,
                opacity: startingBolus ? 0.7 : 1,
              }}
            >
              {startingBolus ? 'Starting…' : 'Start session'}
            </button>
          </div>
        </div>
      )}

      {screenState === 'active' && (
        <>
          <div style={{ textAlign: 'center', padding: '20px 0 28px' }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 200,
                color: '#111827',
                letterSpacing: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatDuration(elapsedSeconds)}
            </div>
            <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>Total session time</div>
          </div>

          {isBolus ? (
            <div
              style={{
                background: phase === 'rest' ? ACCENT_BG : '#eff6ff',
                border: `1px solid ${phase === 'rest' ? ACCENT_BORDER : '#bfdbfe'}`,
                borderRadius: 14,
                padding: 24,
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              {phase === 'bolus' ? (
                <>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Current phase
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>
                    Bolus {bolusRoundsCompleted + 1}
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#92400e',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Rest period
                  </div>
                  <div
                    style={{
                      fontSize: 42,
                      fontWeight: 200,
                      color: '#92400e',
                      letterSpacing: 1,
                      fontVariantNumeric: 'tabular-nums',
                      marginTop: 4,
                    }}
                  >
                    {formatDuration(restSecondsLeft)}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 2 }}>
                    After bolus {bolusRoundsCompleted}
                  </div>
                  <button
                    type="button"
                    onClick={handleSkipRest}
                    style={{
                      marginTop: 12,
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      padding: '7px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#d97706',
                      cursor: 'pointer',
                    }}
                  >
                    Skip rest
                  </button>
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 14,
                padding: 24,
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Session in progress
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d', marginTop: 4 }}>
                {ORAL_TYPE_LABELS[nutritionType] ?? 'Oral feeding'}
              </div>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151' }}>
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={textareaStyle}
              placeholder="e.g. vomited during bolus 2, reduced rate…"
            />
          </label>

          {endError && (
            <p style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
              {endError}
            </p>
          )}

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isBolus && phase === 'bolus' && (
              <button
                type="button"
                onClick={handleBolusComplete}
                disabled={busy}
                style={{ ...primaryBtnStyle('#2563eb'), opacity: busy ? 0.6 : 1 }}
              >
                Bolus complete
              </button>
            )}

            {isBolus ? (
              <button
                type="button"
                onClick={() => setEndConfirmOpen(true)}
                disabled={busy || !session}
                style={{
                  ...secondaryBtnStyle,
                  borderColor: '#16a34a',
                  color: '#16a34a',
                  opacity: busy || !session ? 0.6 : 1,
                }}
              >
                {ending ? 'Saving…' : 'End session'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleEnd(true)}
                disabled={busy || !session}
                style={{ ...primaryBtnStyle('#16a34a'), opacity: busy || !session ? 0.6 : 1 }}
              >
                {ending ? 'Saving…' : isStarting ? 'Starting…' : 'Done'}
              </button>
            )}
          </div>
        </>
      )}

      {abandonConfirmOpen && (
        <Modal onClose={() => setAbandonConfirmOpen(false)} labelledBy={abandonTitleId}>
          <h2
            id={abandonTitleId}
            style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}
          >
            Abandon session?
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>
            The partial session will be recorded. This will not block the next scheduled feed.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setAbandonConfirmOpen(false)}
              style={secondaryBtnStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAbandonConfirm}
              disabled={abandoning}
              style={{ ...primaryBtnStyle('#dc2626'), opacity: abandoning ? 0.7 : 1 }}
            >
              {abandoning ? 'Saving…' : 'Abandon'}
            </button>
          </div>
        </Modal>
      )}

      {endConfirmOpen && (
        <Modal onClose={() => setEndConfirmOpen(false)} labelledBy={endTitleId}>
          <h2
            id={endTitleId}
            style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}
          >
            End session
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
            Was all nutrition consumed?
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              type="button"
              onClick={() => handleEnd(false)}
              disabled={ending}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #fca5a5',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {ending ? 'Saving…' : 'No'}
            </button>
            <button
              type="button"
              onClick={() => handleEnd(true)}
              disabled={ending}
              style={{ ...primaryBtnStyle('#16a34a'), opacity: ending ? 0.7 : 1 }}
            >
              {ending ? 'Saving…' : 'Yes'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setEndConfirmOpen(false)}
            disabled={ending}
            style={{
              display: 'block',
              margin: '10px auto 0',
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Back to session
          </button>
        </Modal>
      )}
    </div>
  );
}
