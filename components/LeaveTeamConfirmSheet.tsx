import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PatientAssignment } from '@/contexts/AuthContext';

type Props = {
  patient: PatientAssignment | null;
  visible: boolean;
  isLoading: boolean;
  error: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function LeaveTeamConfirmSheet({
  patient,
  visible,
  isLoading,
  error,
  onConfirm,
  onDismiss,
}: Props) {
  const patientName = patient?.careRecipientName ?? 'this patient';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Leave this team?</Text>
          <Text style={styles.body}>
            You&rsquo;ll lose access to {patientName}&rsquo;s schedule and care log unless
            you&rsquo;re invited back.
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.leaveBtn, isLoading && styles.buttonDisabled]}
            onPress={onConfirm}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={`Confirm leaving ${patientName}'s team`}
          >
            <Text style={styles.leaveBtnText}>{isLoading ? 'Leaving…' : 'Leave'}</Text>
          </Pressable>
          <Pressable
            style={styles.cancelBtn}
            onPress={onDismiss}
            disabled={isLoading}
            accessibilityRole="button"
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
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
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 20,
  },
  error: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 16,
  },
  leaveBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  leaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 15,
  },
});
