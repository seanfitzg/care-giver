import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityConfirmSheet } from '@/components/ActivityConfirmSheet';
import { BulkCatchUpSheet } from '@/components/BulkCatchUpSheet';
import { MedicationConfirmSheet } from '@/components/MedicationConfirmSheet';
import { PRNMedicationSheet } from '@/components/PRNMedicationSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useBulkCatchUp } from '@/hooks/useBulkCatchUp';
import { useMarkNutritionDone } from '@/hooks/useMarkNutritionDone';
import { useRecordActivity } from '@/hooks/useRecordActivity';
import { useRecordMedication } from '@/hooks/useRecordMedication';
import { useSkipActivity } from '@/hooks/useSkipActivity';
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
  skipped: { label: 'Skipped', color: '#6b7280', bg: '#f3f4f6' },
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
  onSkip,
  onQuickDone,
  onViewDetail,
}: {
  item: TimelineItem;
  variant?: 'default' | 'overdue' | 'supplement';
  onRecord?: (item: TimelineItem) => void;
  onSkip?: (item: TimelineItem) => void;
  onQuickDone?: (item: TimelineItem) => void;
  onViewDetail?: (item: TimelineItem) => void;
}) {
  const isDone = item.status === 'done';
  const canRecord = (item.status === 'overdue' || item.status === 'upcoming') && !!onRecord;
  const canSkip = item.status === 'overdue' && item.type === 'activity' && !!onSkip;
  const canQuickDone = item.status === 'overdue' && item.type === 'nutrition' && !!onQuickDone;

  const cardStyle = [
    styles.card,
    variant === 'overdue' && styles.cardOverdue,
    variant === 'supplement' && styles.cardSupplement,
    isDone && styles.cardDone,
  ];

  const bodyContent = (
    <>
      <TypeIcon type={item.type} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, isDone && styles.cardNameDone]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardTime}>{formatTime(item.scheduledAt)}</Text>
        {item.type === 'medication_scheduled' && item.isCompulsory && (
          <View style={styles.compulsoryBadge}>
            <Text style={styles.compulsoryBadgeText}>Compulsory</Text>
          </View>
        )}
        {isDone && item.completedByName && (
          <Text style={styles.cardCarerName}>
            {item.type === 'activity' ? 'Done' : 'Given'} by {item.completedByName}
          </Text>
        )}
      </View>
    </>
  );

  if (canQuickDone) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, onViewDetail && pressed && styles.cardPressed]}
        onPress={() => onViewDetail?.(item)}
      >
        {bodyContent}
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.recordBtn, { backgroundColor: TYPE_CONFIG[item.type].bg }]}
            onPress={() => onRecord!(item)}
          >
            <Ionicons name="play-circle-outline" size={18} color={TYPE_CONFIG[item.type].color} />
            <Text style={[styles.recordBtnText, { color: TYPE_CONFIG[item.type].color }]}>
              Start
            </Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={() => onQuickDone(item)}>
            <Text style={styles.skipBtnText}>Mark as done</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  if (canSkip) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, onViewDetail && pressed && styles.cardPressed]}
        onPress={() => onViewDetail?.(item)}
      >
        {bodyContent}
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.recordBtn, { backgroundColor: TYPE_CONFIG[item.type].bg }]}
            onPress={() => onRecord!(item)}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={TYPE_CONFIG[item.type].color}
            />
            <Text style={[styles.recordBtnText, { color: TYPE_CONFIG[item.type].color }]}>
              Record
            </Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={() => onSkip(item)}>
            <Text style={styles.skipBtnText}>Skip for Today</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  const cardContent = (
    <>
      {bodyContent}
      {canRecord ? (
        <View style={[styles.recordBtn, { backgroundColor: TYPE_CONFIG[item.type].bg }]}>
          <Ionicons
            name={item.type === 'nutrition' ? 'play-circle-outline' : 'checkmark-circle-outline'}
            size={18}
            color={TYPE_CONFIG[item.type].color}
          />
          <Text style={[styles.recordBtnText, { color: TYPE_CONFIG[item.type].color }]}>
            {item.type === 'nutrition' ? 'Start' : 'Record'}
          </Text>
        </View>
      ) : (
        <StatusBadge status={item.status} />
      )}
    </>
  );

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

  if (onViewDetail) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, pressed && styles.cardPressed]}
        onPress={() => onViewDetail(item)}
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
  const router = useRouter();
  const { careRecipientId, user } = useAuth();
  const { items, isLoading, refetch } = useTimeline(careRecipientId);
  const { mutate: recordMedication, isPending: isMedPending } = useRecordMedication();
  const { mutate: recordActivity, isPending: isActivityPending } = useRecordActivity();
  const { mutate: skipActivity } = useSkipActivity();
  const { mutate: markNutritionDone } = useMarkNutritionDone();
  const { mutate: recordPRN, isPending: isPRNPending } = useRecordPRNMedication();
  const { mutate: bulkCatchUp, isPending: isBulkPending } = useBulkCatchUp();
  const { data: prnMedications = [], isLoading: isPRNLoading } = usePRNMedications(careRecipientId);
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);
  const [detailItem, setDetailItem] = useState<TimelineItem | null>(null);
  const [prnSheetVisible, setPRNSheetVisible] = useState(false);
  const [catchUpSheetVisible, setCatchUpSheetVisible] = useState(false);

  const overdue = items.filter((i) => i.status === 'overdue');
  const earlierToday = items.filter(
    (i) => i.status === 'done' || i.status === 'missed' || i.status === 'skipped',
  );
  const upcoming = items.filter((i) => i.status === 'upcoming');

  function handleItemTap(item: TimelineItem) {
    if (item.type === 'nutrition') {
      router.push({
        pathname: '/nutrition-session',
        params: {
          scheduledItemId: item.scheduledItemId,
          name: item.name,
          nutritionType: item.nutritionType ?? 'bolus',
          bolusRestMinutes: String(item.bolusRestMinutes ?? 20),
        },
      } as never);
    } else {
      setSelectedItem(item);
    }
  }

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

  function handleQuickDoneNutrition(item: TimelineItem) {
    if (!careRecipientId || !user) return;
    markNutritionDone(
      { careRecipientId, scheduledItemId: item.scheduledItemId, carerId: user.id },
      { onError: () => Alert.alert('Error', 'Failed to record nutrition. Please try again.') },
    );
  }

  function handleSkip(item: TimelineItem) {
    if (!careRecipientId || !user) return;
    skipActivity(
      { careRecipientId, scheduledItemId: item.scheduledItemId, carerId: user.id },
      { onError: () => Alert.alert('Error', 'Failed to skip activity. Please try again.') },
    );
  }

  function handleBulkCatchUp(notes: string) {
    if (!careRecipientId || !user) return;
    bulkCatchUp(
      { careRecipientId, carerId: user.id, items: overdue, notes: notes.trim() || undefined },
      {
        onSuccess: () => setCatchUpSheetVisible(false),
        onError: () => Alert.alert('Error', 'Failed to catch up. Please try again.'),
      },
    );
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
            <View style={styles.overdueBannerHeader}>
              <Text style={styles.overdueBannerTitle}>
                {overdue.length} overdue {overdue.length === 1 ? 'task' : 'tasks'}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.catchUpBtn, pressed && styles.catchUpBtnPressed]}
                onPress={() => setCatchUpSheetVisible(true)}
              >
                <Text style={styles.catchUpBtnText}>Catch up</Text>
              </Pressable>
            </View>
            {overdue.map((item) => (
              <TaskCard
                key={item.key}
                item={item}
                variant={item.isCompulsory ? 'overdue' : 'supplement'}
                onRecord={handleItemTap}
                onSkip={handleSkip}
                onQuickDone={handleQuickDoneNutrition}
                onViewDetail={setDetailItem}
              />
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
                      item.status === 'done'
                        ? styles.spineDotDone
                        : item.status === 'skipped'
                          ? styles.spineDotSkipped
                          : styles.spineDotMissed,
                    ]}
                  />
                  {idx < earlierToday.length - 1 && <View style={styles.spineLine} />}
                </View>
                <View style={styles.cardWrapper}>
                  <TaskCard item={item} onViewDetail={setDetailItem} />
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
                  <TaskCard item={item} onRecord={handleItemTap} />
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
      <BulkCatchUpSheet
        items={overdue}
        visible={catchUpSheetVisible}
        isLoading={isBulkPending}
        onConfirm={handleBulkCatchUp}
        onDismiss={() => setCatchUpSheetVisible(false)}
      />
      <Modal
        visible={!!detailItem}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailItem(null)}
      >
        <View style={styles.detailOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDetailItem(null)} />
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            {detailItem && (
              <>
                <Text style={styles.detailTypeLabel}>{TYPE_CONFIG[detailItem.type].label}</Text>
                <Text style={styles.detailName}>{detailItem.name}</Text>
                <Text style={styles.detailTime}>{formatTime(detailItem.scheduledAt)}</Text>
                <StatusBadge status={detailItem.status} />
                {detailItem.description ? (
                  <View
                    style={[
                      styles.detailDescBox,
                      { backgroundColor: TYPE_CONFIG[detailItem.type].bg },
                    ]}
                  >
                    <Text
                      style={[styles.detailDescText, { color: TYPE_CONFIG[detailItem.type].color }]}
                    >
                      {detailItem.description}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.detailNoDesc}>No description</Text>
                )}
              </>
            )}
            <Pressable style={styles.detailCloseBtn} onPress={() => setDetailItem(null)}>
              <Text style={styles.detailCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  overdueBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  overdueBannerTitle: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  catchUpBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catchUpBtnPressed: { opacity: 0.8 },
  catchUpBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

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
  spineDotSkipped: { backgroundColor: '#9ca3af' },
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
  cardSupplement: {
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
    backgroundColor: '#fff',
  },
  cardDone: { opacity: 0.7 },
  cardPressed: { opacity: 0.85 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  cardNameDone: { color: '#6b7280' },
  cardTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cardCarerName: { fontSize: 11, color: '#16a34a', marginTop: 2 },
  compulsoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  compulsoryBadgeText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },

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

  cardActions: { alignItems: 'flex-end', gap: 6 },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  skipBtnText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },

  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48, fontSize: 14 },

  detailOverlay: { flex: 1, justifyContent: 'flex-end' },
  detailSheet: {
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
  detailHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  detailTypeLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  detailName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 2 },
  detailTime: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  detailDescBox: { borderRadius: 8, padding: 10, marginTop: 16, marginBottom: 4 },
  detailDescText: { fontSize: 14, lineHeight: 20 },
  detailNoDesc: { fontSize: 14, color: '#9ca3af', marginTop: 16, fontStyle: 'italic' },
  detailCloseBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 16 },
  detailCloseBtnText: { color: '#6b7280', fontSize: 15 },

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
