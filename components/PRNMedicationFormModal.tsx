import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PRNMedication } from '@/hooks/usePRNMedications';

type Props = {
  visible: boolean;
  medication?: PRNMedication | null;
  isSaving: boolean;
  onSave: (name: string, notes: string) => void;
  onDismiss: () => void;
};

export function PRNMedicationFormModal({
  visible,
  medication,
  isSaving,
  onSave,
  onDismiss,
}: Props) {
  const isEdit = !!medication;
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevMedication, setPrevMedication] = useState(medication);
  if (visible !== prevVisible || medication !== prevMedication) {
    setPrevVisible(visible);
    setPrevMedication(medication);
    if (visible) {
      setName(medication?.name ?? '');
      setNotes(medication?.notes ?? '');
    }
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim(), notes.trim());
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onDismiss}
    >
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>
          {isEdit ? 'Edit medication' : 'Add as-needed medication'}
        </Text>
        <Text style={styles.subtitle}>
          Carers will be able to record doses of this medication at any time.
        </Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Paracetamol"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="e.g. dose, max frequency…"
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <View style={styles.modalActions}>
          <Pressable style={styles.cancelButton} onPress={onDismiss} disabled={isSaving}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.saveButton, (!name.trim() || isSaving) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>{isEdit ? 'Save changes' : 'Add medication'}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, padding: 24, paddingTop: 40 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  textarea: { minHeight: 84 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#374151' },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  saveText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
