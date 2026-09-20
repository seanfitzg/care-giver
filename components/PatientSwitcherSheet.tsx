import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PatientAssignment } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/roles';

type Props = {
  visible: boolean;
  patients: PatientAssignment[];
  activeCareRecipientId: string | null;
  onSelect: (careRecipientId: string) => void;
  onManageTeams: () => void;
  onDismiss: () => void;
};

export function PatientSwitcherSheet({
  visible,
  patients,
  activeCareRecipientId,
  onSelect,
  onManageTeams,
  onDismiss,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Switch patient</Text>

          <View>
            {patients.map((item) => {
              const isActive = item.careRecipientId === activeCareRecipientId;
              return (
                <Pressable
                  key={item.careRecipientId}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => onSelect(item.careRecipientId)}
                  accessibilityRole="button"
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>
                      {item.careRecipientName ?? 'Unnamed patient'}
                    </Text>
                    <Text style={styles.rowRole}>{ROLE_LABELS[item.role]}</Text>
                  </View>
                  {isActive && <Ionicons name="checkmark" size={20} color="#2563eb" />}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.manageTeamsRow, pressed && styles.rowPressed]}
            onPress={onManageTeams}
            accessibilityRole="button"
          >
            <Text style={styles.manageTeamsText}>Manage teams</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  rowPressed: {
    backgroundColor: '#f3f4f6',
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowRole: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  manageTeamsRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  manageTeamsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
});
