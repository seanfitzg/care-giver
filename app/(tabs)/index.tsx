import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityConfirmSheet } from '@/components/ActivityConfirmSheet';
import { MedicationConfirmSheet } from '@/components/MedicationConfirmSheet';
import { PRNMedicationSheet } from '@/components/PRNMedicationSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useRecordActivity } from '@/hooks/useRecordActivity';
import { useRecordMedication } from '@/hooks/useRecordMedication';
import { useRecordPRNMedication } from '@/hooks/useRecordPRNMedication';
import { usePRNMedications } from '@/hooks/usePRNMedications';
import { useTimeline, PAST_HOURS, FUTURE_HOURS } from '@/hooks/useTimeline';
import type { ItemStatus, ItemType, TimelineItem } from '@/hooks/useTimeline';

const TYPE_CONFIG: Record<
  ItemType,
  { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string; label: string }
> = {
  medication_scheduled: { icon: 'medkit-outline', color: '#2563eb', bg: '#eff6ff', label: 'Med' },
  nutrition: { icon: 'water-outline', color: '#d97706', bg: '#fffbeb', label: 'Nutrition' },
  activity: { icon: 'walk-outline', color: '#16a34a', bg: '#f0fdf4', label: 'Activity' },
};

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string }> = {
  overdue: { label: 'Overdue', color: '#dc2626', bg: '#fef2f2' },
  done: { label: 'Done', color: '#16a34a', bg: '#f0fdf4' },
  missed: { label: 'Missed', color: '#7c3aed', bg: '#f5f3ff' },
  upcoming: { label: 'Upcoming', color: '#6b7280', bg: '#f9fafb' },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TypeIcon({ type }: { type: ItemType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <View style={[styles.typeIcon, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={16} color={cfg.color} />
    </View>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  if (status === 'upcoming') return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function TaskCard({
  item,
  variant = 'default',
  onRecord,
}: {
  item: TimelineItem;
  variant?: 'default' | 'overdue';
  onRecord?: (item: TimelineItem) => void;
}) {
  const isDone = item.status === 'done';
  const canRecord =
    (item.type === 'medication_scheduled' || item.type === 'activity') &&
    (item.status === 'overdue' || item.status === 'upcoming') &&
    !!onRecord;

  const cardContent = (
    <>
      <TypeIcon type={item.type} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, isDone && styles.cardNameDone]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardTime}>{formatTime(item.scheduledAt)}</Text>
        {isDone && item.completedByName && (
          <Text style={styles.cardCarerName}>
            {item.type === 'activity' ? 'Done' : 'Given'} by {item.completedByName}
          </Text>
        )}
      </View>
      {canRecord ? (
        <View style={[styles.recordBtn, { backgroundColor: TYPE_CONFIG[item.type].bg }]}>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={TYPE_CONFIG[item.type].color}
          />
          <Text style={[styles.recordBtnText, { color: TYPE_CONFIG[item.type].color }]}>
            Record
          </Text>
        </View>
      ) : (
        <StatusBadge status={item.status} />
      )}
    </>
  );

  const cardStyle = [
    styles.card,
    variant === 'overdue' && styles.cardOverdue,
    isDone && styles.cardDone,
  ];

  if (canRecord) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, pressed && styles.cardPressed]}
        onPress={() => onRecord(item)}
      >
        {cardContent}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{cardContent}</View>;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export default function TodayScreen() {
  const { careRecipientId, user } = useAuth();
  const { items, isLoading, refetch } = useTimeline(careRecipientId);
  const { mutate: recordMedication, isPending: isMedPending } = useRecordMedication();
  const { mutate: recordActivity, isPending: isActivityPending } = useRecordActivity();
  const { mutate: recordPRN, isPending: isPRNPending } = useRecordPRNMedication();
  const { data: prnMedications = [], isLoading: isPRNLoading } = usePRNMedications(careRecipientId);
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);
  const [prnSheetVisible, setPRNSheetVisible] = useState(false);

  const overdue = items.filter((i) => i.status === 'overdue');
  const earlierToday = items.filter((i) => i.status === 'done' || i.status === 'missed');
  const upcoming = items.filter((i) => i.status === 'upcoming');

  function handleRecord(notes: string) {
    if (!selectedItem || !careRecipientId || !user) return;
    const vars = {
      careRecipientId,
      scheduledItemId: selectedItem.scheduledItemId,
      carerId: user.id,
      notes: notes.trim() || undefined,
    };
    if (selectedItem.type === 'activity') {
      recordActivity(vars, {
        onSuccess: () => setSelectedItem(null),
        onError: () => Alert.alert('Error', 'Failed to record activity. Please try again.'),
      });
    } else {
      recordMedication(vars, {
        onSuccess: () => setSelectedItem(null),
        onError: () => Alert.alert('Error', 'Failed to record medication. Please try again.'),
      });
    }
  }

  function handleRecordPRN(medicationId: string, notes: string) {
    if (!careRecipientId || !user) return;
    recordPRN(
      {
        careRecipientId,
        prnMedicationId: medicationId,
        carerId: user.id,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => setPRNSheetVisible(false),
        onError: () => Alert.alert('Error', 'Failed to record medication. Please try again.'),
      },
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setPRNSheetVisible(true)}
        accessibilityLabel="Record as-needed medication"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Window label */}
        <Text style={styles.windowLabel}>
          Past {PAST_HOURS}h · Next {FUTURE_HOURS}h
        </Text>

        {/* Overdue section */}
        {overdue.length > 0 && (
          <View style={styles.overdueBanner}>
            <Text style={styles.overdueBannerTitle}>
              {overdue.length} overdue {overdue.length === 1 ? 'task' : 'tasks'}
            </Text>
            {overdue.map((item) => (
              <TaskCard key={item.key} item={item} variant="overdue" onRecord={setSelectedItem} />
            ))}
          </View>
        )}

        {/* Earlier today */}
        {earlierToday.length > 0 && (
          <>
            <SectionHeader title="Earlier today" />
            {earlierToday.map((item, idx) => (
              <View key={item.key} style={styles.spineRow}>
                <View style={styles.spineColumn}>
                  <View
                    style={[
                      styles.spineDot,
                      item.status === 'done' ? styles.spineDotDone : styles.spineDotMissed,
                    ]}
                  />
                  {idx < earlierToday.length - 1 && <View style={styles.spineLine} />}
                </View>
                <View style={styles.cardWrapper}>
                  <TaskCard item={item} />
                </View>
              </View>
            ))}
          </>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <SectionHeader title="Upcoming" />
            {upcoming.map((item, idx) => (
              <View key={item.key} style={styles.spineRow}>
                <View style={styles.spineColumn}>
                  <View style={[styles.spineDot, styles.spineDotUpcoming]} />
                  {idx < upcoming.length - 1 && <View style={styles.spineLine} />}
                </View>
                <View style={styles.cardWrapper}>
                  <TaskCard item={item} onRecord={setSelectedItem} />
                </View>
              </View>
            ))}
          </>
        )}

        {items.length === 0 && <Text style={styles.empty}>No tasks in this window.</Text>}
      </ScrollView>

      <MedicationConfirmSheet
        item={selectedItem?.type === 'medication_scheduled' ? selectedItem : null}
        visible={selectedItem?.type === 'medication_scheduled'}
        isLoading={isMedPending}
        onConfirm={handleRecord}
        onDismiss={() => setSelectedItem(null)}
      />
      <ActivityConfirmSheet
        item={selectedItem?.type === 'activity' ? selectedItem : null}
        visible={selectedItem?.type === 'activity'}
        isLoading={isActivityPending}
        onConfirm={handleRecord}
        onDismiss={() => setSelectedItem(null)}
      />
      <PRNMedicationSheet
        visible={prnSheetVisible}
        medications={prnMedications}
        isLoadingMedications={isPRNLoading}
        isSaving={isPRNPending}
        onConfirm={handleRecordPRN}
        onDismiss={() => setPRNSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  windowLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 12 },

  overdueBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  overdueBannerTitle: { fontSize: 12, fontWeight: '700', color: '#dc2626', marginBottom: 8 },

  sectionHeader: { marginTop: 8, marginBottom: 6 },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  spineRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 2 },
  spineColumn: { alignItems: 'center', paddingTop: 14, width: 12 },
  spineDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  spineDotDone: { backgroundColor: '#16a34a' },
  spineDotMissed: { backgroundColor: '#7c3aed' },
  spineDotUpcoming: { backgroundColor: '#d1d5db', borderWidth: 2, borderColor: '#d1d5db' },
  spineLine: { width: 1, flex: 1, backgroundColor: '#e5e7eb', marginTop: 2 },
  cardWrapper: { flex: 1, marginBottom: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
    backgroundColor: '#fff',
  },
  cardDone: { opacity: 0.7 },
  cardPressed: { opacity: 0.85 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  cardNameDone: { color: '#6b7280' },
  cardTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cardCarerName: { fontSize: 11, color: '#16a34a', marginTop: 2 },

  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  recordBtnText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },

  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48, fontSize: 14 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
});
