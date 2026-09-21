import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LeaveTeamConfirmSheet } from '@/components/LeaveTeamConfirmSheet';
import { useAuth, type PatientAssignment } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS } from '@/lib/roles';

export default function PatientPickerScreen() {
  const { allPatients, careRecipientId, setActivePatient, user, refresh, signOut } = useAuth();
  const router = useRouter();
  const [leavingPatient, setLeavingPatient] = useState<PatientAssignment | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const handleSelect = async (careRecipientId: string) => {
    await setActivePatient(careRecipientId);
    router.replace('/(tabs)');
  };

  const handleConfirmLeave = async () => {
    if (!leavingPatient) return;

    if (!user) {
      setLeaveError('Your session has expired. Please sign in again.');
      return;
    }

    setIsLeaving(true);
    setLeaveError(null);

    // .select('id') so a 0-row RLS-filtered delete (the leave policy
    // rejecting an admin's own row) is distinguishable from success — a
    // plain delete() returns no error when RLS matches zero rows.
    const { data, error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', user.id)
      .eq('care_recipient_id', leavingPatient.careRecipientId)
      .select('id');

    setIsLeaving(false);

    if (error || !data || data.length === 0) {
      setLeaveError('Could not leave this team. Please try again.');
      return;
    }

    setLeavingPatient(null);
    await refresh();
  };

  const closeLeaveModal = () => {
    if (isLeaving) return;
    setLeavingPatient(null);
    setLeaveError(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a patient</Text>
      <Text style={styles.subtitle}>Select who you&rsquo;re caring for right now.</Text>

      <FlatList
        data={allPatients}
        keyExtractor={(item) => item.careRecipientId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isActive = item.careRecipientId === careRecipientId;
          const canLeave = item.role !== 'admin';
          const patientName = item.careRecipientName ?? 'Unnamed patient';
          return (
            <View style={[styles.card, isActive && styles.cardActive]}>
              <Pressable
                style={({ pressed }) => [styles.cardSelect, pressed && styles.cardPressed]}
                onPress={() => handleSelect(item.careRecipientId)}
                accessibilityRole="button"
              >
                <View style={styles.cardText}>
                  <Text style={styles.cardName}>{patientName}</Text>
                  <Text style={styles.cardRole}>{ROLE_LABELS[item.role]}</Text>
                </View>
                {isActive && <Ionicons name="checkmark" size={20} color="#2563eb" />}
              </Pressable>

              {canLeave && (
                <Pressable
                  style={({ pressed }) => [
                    styles.leaveButton,
                    pressed && styles.leaveButtonPressed,
                  ]}
                  onPress={() => setLeavingPatient(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Leave ${patientName}'s team`}
                >
                  <Text style={styles.leaveButtonText}>Leave</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />

      <Pressable
        style={styles.startTeam}
        onPress={() => router.push('/(setup)/create-recipient')}
        accessibilityRole="button"
      >
        <Text style={styles.startTeamText}>Start a new team</Text>
      </Pressable>

      <Pressable onPress={signOut} style={styles.signOut} accessibilityRole="button">
        <Text style={styles.signOutText}>Not you? Sign out</Text>
      </Pressable>

      <LeaveTeamConfirmSheet
        patient={leavingPatient}
        visible={!!leavingPatient}
        isLoading={isLeaving}
        error={leaveError}
        onConfirm={handleConfirmLeave}
        onDismiss={closeLeaveModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingTop: 72,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  cardSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardPressed: {
    backgroundColor: '#f3f4f6',
  },
  cardText: { flex: 1 },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardRole: {
    fontSize: 13,
    color: '#6b7280',
  },
  leaveButton: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  leaveButtonPressed: {
    backgroundColor: '#fef2f2',
  },
  leaveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  startTeam: {
    alignSelf: 'center',
    paddingTop: 20,
  },
  startTeamText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  signOut: {
    alignSelf: 'center',
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
