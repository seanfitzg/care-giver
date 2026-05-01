import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'senior_carer' | 'carer';

type CarerRow = {
  id: string;
  user_id: string;
  role: 'admin' | UserRole;
  email: string | null;
};

async function fetchCarers(careRecipientId: string): Promise<CarerRow[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('id, user_id, role')
    .eq('care_recipient_id', careRecipientId);
  if (error) throw error;

  // Fetch emails via a public-safe RPC rather than querying auth.users directly.
  // Falls back to showing the user_id if unavailable.
  const rows: CarerRow[] = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: profile } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', row.user_id)
        .single();
      return { ...row, email: profile ? null : null };
    }),
  );
  return rows;
}

export default function AdminScreen() {
  const { careRecipientId, user } = useAuth();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('carer');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const { data: carers, isLoading } = useQuery({
    queryKey: ['carers', careRecipientId],
    queryFn: () => fetchCarers(careRecipientId!),
    enabled: !!careRecipientId,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: UserRole }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('invite-carer', {
        body: { email, role, care_recipient_id: careRecipientId },
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      const body = res.data as { error?: string };
      if (body?.error) throw new Error(body.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carers', careRecipientId] });
      setInviteModalOpen(false);
      setInviteEmail('');
      Alert.alert('Invite sent', `An invite email has been sent to ${inviteEmail}.`);
    },
    onError: (err: Error) => Alert.alert('Invite failed', err.message),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId)
        .eq('care_recipient_id', careRecipientId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carers', careRecipientId] }),
    onError: (err: Error) => Alert.alert('Role change failed', err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('care_recipient_id', careRecipientId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carers', careRecipientId] }),
    onError: (err: Error) => Alert.alert('Revocation failed', err.message),
  });

  const confirmRevoke = (carer: CarerRow) => {
    Alert.alert(
      'Revoke access',
      `Remove ${carer.email ?? carer.user_id} from this care team? They will no longer be able to view or record care events.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(carer.user_id) },
      ],
    );
  };

  const confirmRoleChange = (carer: CarerRow) => {
    const newRole: UserRole = carer.role === 'carer' ? 'senior_carer' : 'carer';
    const label = newRole === 'senior_carer' ? 'Senior Carer' : 'Carer';
    Alert.alert(
      'Change role',
      `Change this person's role to ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', onPress: () => changeRoleMutation.mutate({ userId: carer.user_id, role: newRole }) },
      ],
    );
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Please enter an email address.');
      return;
    }
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const roleLabel = (role: string) => {
    if (role === 'admin') return 'Admin';
    if (role === 'senior_carer') return 'Senior Carer';
    return 'Carer';
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={carers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Pressable style={styles.inviteButton} onPress={() => setInviteModalOpen(true)}>
            <Text style={styles.inviteButtonText}>+ Invite carer</Text>
          </Pressable>
        }
        renderItem={({ item }) => {
          const isSelf = item.user_id === user?.id;
          return (
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowEmail}>{item.email ?? item.user_id}</Text>
                <Text style={styles.rowRole}>{roleLabel(item.role)}</Text>
              </View>
              {!isSelf && item.role !== 'admin' && (
                <View style={styles.rowActions}>
                  <Pressable style={styles.actionButton} onPress={() => confirmRoleChange(item)}>
                    <Text style={styles.actionText}>Change role</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.revokeButton]} onPress={() => confirmRevoke(item)}>
                    <Text style={[styles.actionText, styles.revokeText]}>Revoke</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No carers yet.</Text>}
      />

      <Modal visible={inviteModalOpen} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Invite a carer</Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#9ca3af"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>Role</Text>
          <View style={styles.roleRow}>
            {(['carer', 'senior_carer'] as UserRole[]).map((r) => (
              <Pressable
                key={r}
                style={[styles.roleOption, inviteRole === r && styles.roleOptionSelected]}
                onPress={() => setInviteRole(r)}
              >
                <Text style={[styles.roleOptionText, inviteRole === r && styles.roleOptionTextSelected]}>
                  {roleLabel(r)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.cancelButton} onPress={() => setInviteModalOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sendButton, inviteMutation.isPending && styles.buttonDisabled]}
              onPress={handleInvite}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendText}>Send invite</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, gap: 12 },
  inviteButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
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
  rowInfo: { flex: 1 },
  rowEmail: { fontSize: 14, fontWeight: '500', color: '#111827' },
  rowRole: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionText: { fontSize: 12, color: '#374151' },
  revokeButton: { borderColor: '#fca5a5' },
  revokeText: { color: '#dc2626' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 32 },
  modal: { flex: 1, padding: 24, paddingTop: 40 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  roleOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  roleOptionSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  roleOptionText: { fontSize: 14, color: '#374151' },
  roleOptionTextSelected: { color: '#2563eb', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#374151' },
  sendButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  sendText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
