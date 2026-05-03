import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type CarerDutyRow = {
  user_id: string;
  role: 'admin' | 'senior_carer' | 'carer';
  email: string | null;
  is_on_duty: boolean;
  checked_in_at: string | null;
};

async function fetchDutyStatus(careRecipientId: string): Promise<CarerDutyRow[]> {
  const { data, error } = await supabase
    .rpc('get_carers_with_duty_status', { p_care_recipient_id: careRecipientId });
  if (error) throw error;
  return (data ?? []) as CarerDutyRow[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  senior_carer: 'Senior',
  carer: 'Carer',
};

function checkedInLabel(ts: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function OnDutyScreen() {
  const { careRecipientId, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['duty-status', careRecipientId],
    queryFn: () => fetchDutyStatus(careRecipientId!),
    enabled: !!careRecipientId,
  });

  useEffect(() => {
    if (!careRecipientId) return;
    const channel = supabase
      .channel(`duty_sessions:${careRecipientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'duty_sessions',
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['duty-status', careRecipientId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [careRecipientId, qc]);

  const checkInMutation = useMutation({
    mutationFn: async (carerId: string) => {
      const { error } = await supabase.from('duty_sessions').insert({
        carer_id: carerId,
        care_recipient_id: careRecipientId!,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-status', careRecipientId] }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async (carerId: string) => {
      const { error } = await supabase
        .from('duty_sessions')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('carer_id', carerId)
        .eq('care_recipient_id', careRecipientId!)
        .is('checked_out_at', null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty-status', careRecipientId] }),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.user_id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={[styles.dot, item.is_on_duty ? styles.dotOn : styles.dotOff]} />
          <View style={styles.info}>
            <Text style={styles.email}>{item.email ?? item.user_id}</Text>
            <View style={styles.meta}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{ROLE_LABELS[item.role] ?? item.role}</Text>
              </View>
              {item.is_on_duty ? (
                item.checked_in_at ? (
                  <Text style={styles.onDutyLabel}>
                    on duty since {checkedInLabel(item.checked_in_at)}
                  </Text>
                ) : (
                  <Text style={styles.onDutyLabel}>on duty</Text>
                )
              ) : (
                <Text style={styles.offDutyLabel}>off duty</Text>
              )}
            </View>
          </View>
          {isAdmin && item.role !== 'admin' && (
            item.is_on_duty ? (
              <Pressable
                style={[styles.action, styles.actionOut]}
                onPress={() => checkOutMutation.mutate(item.user_id)}
                disabled={checkOutMutation.isPending}
              >
                <Text style={styles.actionOutText}>Check out</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.action, styles.actionIn]}
                onPress={() => checkInMutation.mutate(item.user_id)}
                disabled={checkInMutation.isPending}
              >
                <Text style={styles.actionInText}>Check in</Text>
              </Pressable>
            )
          )}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No team members found.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: '#16a34a' },
  dotOff: { backgroundColor: '#d1d5db' },
  info: { flex: 1 },
  email: { fontSize: 14, fontWeight: '500', color: '#111827' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: '#374151', fontWeight: '500' },
  onDutyLabel: { fontSize: 12, color: '#16a34a' },
  offDutyLabel: { fontSize: 12, color: '#9ca3af' },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionIn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  actionInText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  actionOut: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  actionOutText: { fontSize: 12, color: '#dc2626', fontWeight: '500' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 32 },
});
