import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TimelineItem } from '@/hooks/useTimeline';

type Props = {
  item: TimelineItem | null;
  visible: boolean;
  isLoading: boolean;
  onConfirm: (notes: string) => void;
  onDismiss: () => void;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ActivityConfirmSheet({ item, visible, isLoading, onConfirm, onDismiss }: Props) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) setNotes('');
  }, [visible]);

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
            <Text style={styles.title}>Record Activity</Text>
            {item && (
              <>
                <Text style={styles.activityName}>{item.name}</Text>
                <Text style={styles.schedTime}>Scheduled {formatTime(item.scheduledAt)}</Text>
              </>
            )}
            <Text style={styles.noteLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. completed full session, shortened..."
              placeholderTextColor="#9ca3af"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.confirmBtn, isLoading && styles.confirmBtnDisabled]}
              onPress={() => onConfirm(notes)}
              disabled={isLoading}
            >
              <Text style={styles.confirmBtnText}>
                {isLoading ? 'Recording...' : 'Mark as Done'}
              </Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onDismiss} disabled={isLoading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
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
    marginBottom: 4,
  },
  activityName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 2,
  },
  schedTime: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
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
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
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
