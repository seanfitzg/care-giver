import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useDuty } from '@/contexts/DutyContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'admin' | 'senior_carer' | 'carer';

type DutySession = {
  id: string;
  carer_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
};

type CarerWithDuty = {
  user_id: string;
  role: UserRole;
  email: string | null;
  dutySession: DutySession | null; // open session = on duty
  isOnDuty: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function roleLabel(role: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'senior_carer') return 'Senior Carer';
  return 'Carer';
}

function initials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

const AVATAR_COLORS = [
  '#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#0284c7', '#16a34a', '#ca8a04', '#e11d48',
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Data fetching ────────────────────────────────────────────────────────────

type CarerRow = {
  id: string;
  user_id: string;
  role: UserRole;
  email: string | null;
};

async function fetchCarers(careRecipientId: string): Promise<CarerRow[]> {
  const { data, error } = await supabase
    .rpc('get_carers_with_emails', { p_care_recipient_id: careRecipientId });
  if (error) throw error;
  return (data ?? []) as CarerRow[];
}

async function fetchOpenDutySessions(careRecipientId: string): Promise<DutySession[]> {
  const { data, error } = await supabase
    .from('duty_sessions')
    .select('id, carer_id, checked_in_at, checked_out_at')
    .eq('care_recipient_id', careRecipientId)
    .is('checked_out_at', null);
  if (error) throw error;
  return (data ?? []) as DutySession[];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

async function checkInCarer(params: {
  careRecipientId: string;
  carerId: string;
}): Promise<void> {
  const { error } = await supabase.from('duty_sessions').insert({
    care_recipient_id: params.careRecipientId,
    carer_id: params.carerId,
    checked_in_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function checkOutCarer(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('duty_sessions')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ userId, email, size = 36 }: { userId: string; email: string | null; size?: number }) {
  const label = email ? initials(email) : '?';
  const bg = avatarColor(userId);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{label}</Text>
    </View>
  );
}

function OnDutyCard({
  carer,
  isAdmin,
  onCheckOut,
}: {
  carer: CarerWithDuty;
  isAdmin: boolean;
  onCheckOut: () => void;
}) {
  return (
    <View style={[styles.card, styles.cardOnDuty]}>
      <Avatar userId={carer.user_id} email={carer.email} size={36} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {carer.email ?? carer.user_id}
        </Text>
        <Text style={styles.cardMeta}>
          {carer.role === 'admin'
            ? 'Admin · always on duty'
            : carer.dutySession
              ? `Checked in at ${formatTime(carer.dutySession.checked_in_at)}`
              : 'On duty'}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <View style={styles.onDutyDot} />
        {isAdmin && carer.role !== 'admin' && (
          <Pressable style={styles.actionBtn} onPress={onCheckOut}>
            <Text style={styles.actionBtnText}>Check out</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function OffDutyCard({
  carer,
  isAdmin,
  onCheckIn,
}: {
  carer: CarerWithDuty;
  isAdmin: boolean;
  onCheckIn: () => void;
}) {
  return (
    <View style={[styles.card, styles.cardOffDuty]}>
      <Avatar userId={carer.user_id} email={carer.email} size={36} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, styles.cardNameDim]} numberOfLines={1}>
          {carer.email ?? carer.user_id}
        </Text>
        <Text style={styles.cardMeta}>
          {roleLabel(carer.role)} · off duty
        </Text>
      </View>
      {isAdmin && (
        <Pressable style={styles.checkInBtn} onPress={onCheckIn}>
          <Text style={styles.checkInBtnText}>Check in</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnDutyScreen() {
  const { careRecipientId, user, isAdmin } = useAuth();
  const { isOnDuty, checkIn, checkOut } = useDuty();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['carers', careRecipientId] });
    qc.invalidateQueries({ queryKey: ['open_duty_sessions', careRecipientId] });
  };

  // Queries
  const { data: carers = [], isLoading: loadingCarers } = useQuery({
    queryKey: ['carers', careRecipientId],
    queryFn: () => fetchCarers(careRecipientId!),
    enabled: !!careRecipientId,
  });

  const { data: openSessions = [], isLoading: loadingSessions, refetch } = useQuery({
    queryKey: ['open_duty_sessions', careRecipientId],
    queryFn: () => fetchOpenDutySessions(careRecipientId!),
    enabled: !!careRecipientId,
    refetchInterval: 30_000,
  });

  const isLoading = loadingCarers || loadingSessions;

  // Check-in mutation (for self or admin on behalf of carer)
  const checkInMutation = useMutation({
    mutationFn: (carerId: string) =>
      checkInCarer({ careRecipientId: careRecipientId!, carerId }),
    onSuccess: (_, carerId) => {
      if (carerId === user?.id) checkIn();
      invalidate();
    },
    onError: (err: Error) => Alert.alert('Check-in failed', err.message),
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: (sessionId: string) => checkOutCarer(sessionId),
    onSuccess: (_, sessionId) => {
      // If we're checking out ourselves, sync local context
      const mine = openSessions.find(s => s.id === sessionId && s.carer_id === user?.id);
      if (mine) checkOut();
      invalidate();
    },
    onError: (err: Error) => Alert.alert('Check-out failed', err.message),
  });

  // Merge carers with their duty sessions
  const carersWithDuty: CarerWithDuty[] = carers.map(c => {
    const session = openSessions.find(s => s.carer_id === c.user_id) ?? null;
    const isOnDutyNow = c.role === 'admin' || session !== null;
    return {
      user_id: c.user_id,
      role: c.role,
      email: c.email,
      dutySession: session,
      isOnDuty: isOnDutyNow,
    };
  });

  const onDutyCarers = carersWithDuty.filter(c => c.isOnDuty);
  const offDutyCarers = carersWithDuty.filter(c => !c.isOnDuty);

  // Self check-in/out (non-admin carer)
  const myCarer = carersWithDuty.find(c => c.user_id === user?.id);
  const mySession = openSessions.find(s => s.carer_id === user?.id) ?? null;

  const handleSelfCheckIn = () => checkInMutation.mutate(user!.id);
  const handleSelfCheckOut = () => {
    if (!mySession) return;
    Alert.alert(
      'Check out',
      'You will stop receiving notifications for this care recipient.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check out', onPress: () => checkOutMutation.mutate(mySession.id) },
      ],
    );
  };

  const confirmAdminCheckIn = (carer: CarerWithDuty) => {
    Alert.alert(
      'Check in carer',
      `Check in ${carer.email ?? 'this carer'} on their behalf?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check in', onPress: () => checkInMutation.mutate(carer.user_id) },
      ],
    );
  };

  const confirmAdminCheckOut = (carer: CarerWithDuty) => {
    if (!carer.dutySession) return;
    Alert.alert(
      'Check out carer',
      `Check out ${carer.email ?? 'this carer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check out', style: 'destructive', onPress: () => checkOutMutation.mutate(carer.dutySession!.id) },
      ],
    );
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#2563eb" />
      }
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <>
          {/* Self check-in/out card — non-admin only */}
          {!isAdmin && myCarer && (
            <View style={[styles.selfCard, isOnDuty ? styles.selfCardOnDuty : styles.selfCardOffDuty]}>
              <Text style={[styles.selfStatus, isOnDuty ? styles.selfStatusOn : styles.selfStatusOff]}>
                {isOnDuty ? '● You are on duty' : '○ You are off duty'}
              </Text>
              <Text style={styles.selfSubtitle}>
                {isOnDuty
                  ? `Checked in at ${mySession ? formatTime(mySession.checked_in_at) : 'unknown'} · Receiving notifications`
                  : 'Check in to start receiving notifications.'}
              </Text>
              <Pressable
                style={[
                  styles.selfBtn,
                  isOnDuty ? styles.selfBtnOut : styles.selfBtnIn,
                  (checkInMutation.isPending || checkOutMutation.isPending) && styles.btnDisabled,
                ]}
                onPress={isOnDuty ? handleSelfCheckOut : handleSelfCheckIn}
                disabled={checkInMutation.isPending || checkOutMutation.isPending}
              >
                {checkInMutation.isPending || checkOutMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.selfBtnText}>{isOnDuty ? 'Check out' : 'Check in'}</Text>}
              </Pressable>
            </View>
          )}

          {/* On duty section */}
          <Text style={styles.sectionLabel}>
            On duty now ({onDutyCarers.length})
          </Text>
          {onDutyCarers.map(c => (
            <OnDutyCard
              key={c.user_id}
              carer={c}
              isAdmin={isAdmin}
              onCheckOut={() => confirmAdminCheckOut(c)}
            />
          ))}
          {onDutyCarers.length === 0 && (
            <Text style={styles.emptyText}>No one is currently on duty.</Text>
          )}

          {/* Off duty section */}
          {offDutyCarers.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
                Off duty ({offDutyCarers.length})
              </Text>
              {offDutyCarers.map(c => (
                <OffDutyCard
                  key={c.user_id}
                  carer={c}
                  isAdmin={isAdmin}
                  onCheckIn={() => confirmAdminCheckIn(c)}
                />
              ))}
            </>
          )}
        </>
      }
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 8, marginBottom: 8,
  },
  emptyText: { fontSize: 14, color: '#9ca3af', paddingVertical: 8 },

  // Self card
  selfCard: {
    borderRadius: 12, padding: 16, marginBottom: 20, gap: 8,
    borderWidth: 1,
  },
  selfCardOnDuty: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  selfCardOffDuty: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  selfStatus: { fontSize: 14, fontWeight: '700' },
  selfStatusOn: { color: '#15803d' },
  selfStatusOff: { color: '#6b7280' },
  selfSubtitle: { fontSize: 13, color: '#6b7280' },
  selfBtn: {
    borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 4,
  },
  selfBtnIn: { backgroundColor: '#16a34a' },
  selfBtnOut: { backgroundColor: '#dc2626' },
  selfBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Carer cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 10, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardOnDuty: { borderColor: '#d1fae5' },
  cardOffDuty: { opacity: 0.65 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardNameDim: { color: '#6b7280' },
  cardMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onDutyDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#16a34a',
  },

  // Action buttons
  actionBtn: {
    borderWidth: 1, borderColor: '#fca5a5', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  actionBtnText: { fontSize: 12, color: '#dc2626', fontWeight: '500' },
  checkInBtn: {
    borderWidth: 1, borderColor: '#93c5fd',
    backgroundColor: '#eff6ff', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  checkInBtnText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  // Avatar
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontWeight: '700' },
});
