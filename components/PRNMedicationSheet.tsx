import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PRNMedication } from '@/hooks/usePRNMedications';

type Props = {
  visible: boolean;
  medications: PRNMedication[];
  isLoadingMedications: boolean;
  isSaving: boolean;
  onConfirm: (medicationId: string, notes: string) => void;
  onDismiss: () => void;
};

export function PRNMedicationSheet({
  visible,
  medications,
  isLoadingMedications,
  isSaving,
  onConfirm,
  onDismiss,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setNotes('');
    }
  }, [visible]);

  function handleConfirm() {
    if (!selectedId) return;
    onConfirm(selectedId, notes);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>As-Needed Medication</Text>

            {isLoadingMedications ? (
              <ActivityIndicator style={styles.loader} color="#7c3aed" />
            ) : medications.length === 0 ? (
              <Text style={styles.empty}>No as-needed medications configured.</Text>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Select medication</Text>
                <ScrollView style={styles.medicationList} showsVerticalScrollIndicator={false}>
                  {medications.map((med) => {
                    const isSelected = med.id === selectedId;
                    return (
                      <Pressable
                        key={med.id}
                        style={[styles.medOption, isSelected && styles.medOptionSelected]}
                        onPress={() => setSelectedId(med.id)}
                      >
                        <View style={styles.medOptionRow}>
                          <View style={[styles.radio, isSelected && styles.radioSelected]}>
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                          <View style={styles.medTextBlock}>
                            <Text style={[styles.medName, isSelected && styles.medNameSelected]}>
                              {med.name}
                            </Text>
                            {med.notes ? (
                              <Text style={styles.medSubNotes}>{med.notes}</Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={styles.sectionLabel}>Note (optional)</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g. reason for dose, observations..."
                  placeholderTextColor="#9ca3af"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <Pressable
                  style={[
                    styles.confirmBtn,
                    (!selectedId || isSaving) && styles.confirmBtnDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={!selectedId || isSaving}
                >
                  <Text style={styles.confirmBtnText}>
                    {isSaving ? 'Recording...' : 'Record Medication'}
                  </Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={onDismiss} disabled={isSaving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  sheetWrapper: { width: '100%' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: '85%',
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
    marginBottom: 16,
  },
  loader: { marginVertical: 32 },
  empty: {
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  medicationList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  medOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  medOptionSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#f5f3ff',
  },
  medOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#7c3aed' },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7c3aed',
  },
  medTextBlock: { flex: 1 },
  medName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  medNameSelected: { color: '#6d28d9' },
  medSubNotes: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 72,
    marginBottom: 20,
    backgroundColor: '#f9fafb',
  },
  confirmBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#6b7280', fontSize: 15 },
});
