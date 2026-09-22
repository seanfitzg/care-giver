import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
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
import type { ItemType, TimelineItem } from '@/hooks/useTimeline';

type Props = {
  items: TimelineItem[];
  visible: boolean;
  isLoading: boolean;
  onConfirm: (notes: string) => void;
  onDismiss: () => void;
};

const TYPE_ICONS: Record<ItemType, React.ComponentProps<typeof Ionicons>['name']> = {
  medication_scheduled: 'medkit-outline',
  nutrition: 'water-outline',
  activity: 'walk-outline',
};

const TYPE_COLORS: Record<ItemType, string> = {
  medication_scheduled: '#2563eb',
  nutrition: '#d97706',
  activity: '#16a34a',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BulkCatchUpSheet({ items, visible, isLoading, onConfirm, onDismiss }: Props) {
  const [notes, setNotes] = useState('');
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) setNotes('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Mark all as done</Text>
            <Text style={styles.subtitle}>
              Mark {items.length} {items.length === 1 ? 'item' : 'items'} as done
            </Text>

            <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <View key={item.key} style={styles.itemRow}>
                  <View
                    style={[styles.itemIcon, { backgroundColor: TYPE_COLORS[item.type] + '1a' }]}
                  >
                    <Ionicons
                      name={TYPE_ICONS[item.type]}
                      size={14}
                      color={TYPE_COLORS[item.type]}
                    />
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemTime}>Scheduled {formatTime(item.scheduledAt)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.noteLabel}>Shared note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. all given together..."
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
                {isLoading ? 'Saving...' : 'Mark All as Done'}
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
    maxHeight: '80%',
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
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  itemList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  itemTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
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
    backgroundColor: '#dc2626',
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
