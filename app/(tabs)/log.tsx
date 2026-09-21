import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCareLogs } from '@/hooks/useCareLogs';
import type { CareLogEntry } from '@/hooks/useCareLogs';

type FilterChip = 'all' | 'medication' | 'nutrition' | 'activity' | 'missed';

type EventConfig = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
  label: string;
};

const EVENT_CONFIG: Record<CareLogEntry['event_type'], EventConfig> = {
  medication_scheduled: { icon: 'medkit-outline', color: '#2563eb', bg: '#eff6ff', label: 'Med' },
  as_needed_medication: { icon: 'flask-outline', color: '#7c3aed', bg: '#f5f3ff', label: 'PRN' },
  nutrition: { icon: 'water-outline', color: '#d97706', bg: '#fffbeb', label: 'Nutrition' },
  activity: { icon: 'walk-outline', color: '#16a34a', bg: '#f0fdf4', label: 'Activity' },
};

const STATUS_BADGE: Record<CareLogEntry['status'], { label: string; color: string; bg: string }> = {
  completed: { label: 'Done', color: '#16a34a', bg: '#f0fdf4' },
  missed: { label: 'Missed', color: '#dc2626', bg: '#fef2f2' },
  skipped: { label: 'Skipped', color: '#6b7280', bg: '#f3f4f6' },
};

const CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'medication', label: 'Medication' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'activity', label: 'Activity' },
  { key: 'missed', label: 'Missed' },
];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatDateLabel(d: Date): string {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function entryName(entry: CareLogEntry): string {
  if (entry.prn_medication?.name) return entry.prn_medication.name;
  if (entry.scheduled_item?.name) return entry.scheduled_item.name;
  return entry.event_type.replace(/_/g, ' ');
}

function LogCard({
  entry,
  carerNames,
  wide,
  onPress,
}: {
  entry: CareLogEntry;
  carerNames: Record<string, string>;
  wide: boolean;
  onPress: (entry: CareLogEntry) => void;
}) {
  const cfg = EVENT_CONFIG[entry.event_type];
  const statusBadge = STATUS_BADGE[entry.status];
  const carerName = entry.carer_id ? carerNames[entry.carer_id] : null;
  const isPRN = entry.event_type === 'as_needed_medication';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, wide && styles.cardWide, pressed && styles.cardPressed]}
      onPress={() => onPress(entry)}
    >
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {entryName(entry)}
          </Text>
          {isPRN && (
            <View style={[styles.badge, styles.badgePRN]}>
              <Text style={[styles.badgeText, { color: '#7c3aed' }]}>PRN</Text>
            </View>
          )}
          {entry.bulk_confirmed && (
            <View style={[styles.badge, styles.badgeCatchUp]}>
              <Text style={[styles.badgeText, { color: '#b45309' }]}>Bulk</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[styles.badgeText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
          </View>
        </View>
        <Text style={styles.cardTime}>{formatTime(entry.occurred_at)}</Text>
        {carerName ? (
          <Text style={styles.cardCarer}>
            {entry.status === 'completed' ? 'By' : entry.status === 'skipped' ? 'Skipped by' : ''}{' '}
            {carerName}
          </Text>
        ) : entry.status === 'missed' ? (
          <Text style={styles.cardCarerMissed}>Not completed</Text>
        ) : null}
        {entry.notes ? <Text style={styles.cardNotes}>{entry.notes}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function LogScreen() {
  const { careRecipientId, user, isAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [selectedEntry, setSelectedEntry] = useState<CareLogEntry | null>(null);

  const today = startOfDay(new Date());
  const isToday = date.getTime() === today.getTime();

  const { data, isLoading, refetch } = useCareLogs(careRecipientId, date);

  const carerNames = data?.carerNames ?? {};

  const visibleEntries = useMemo(() => {
    const entries = data?.entries ?? [];
    // Non-admins only see their own events plus system-generated missed events (null carer)
    let list = isAdmin
      ? entries
      : entries.filter((e) => e.carer_id === user?.id || e.carer_id === null);

    switch (activeFilter) {
      case 'medication':
        list = list.filter(
          (e) => e.event_type === 'medication_scheduled' || e.event_type === 'as_needed_medication',
        );
        break;
      case 'nutrition':
        list = list.filter((e) => e.event_type === 'nutrition');
        break;
      case 'activity':
        list = list.filter((e) => e.event_type === 'activity');
        break;
      case 'missed':
        list = list.filter((e) => e.status === 'missed');
        break;
    }
    return list;
  }, [data?.entries, activeFilter, isAdmin, user?.id]);

  function prevDay() {
    setDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 1);
      return n;
    });
    setShowPicker(false);
  }

  function nextDay() {
    if (isToday) return;
    setDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      return n;
    });
    setShowPicker(false);
  }

  // On iOS the inline picker fires on every tap — auto-close after selection.
  // On Android the system dialog closes itself.
  // On web the browser popup closes itself; the input just needs to be visible.
  function handlePickerChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) {
      setDate(startOfDay(selected));
      if (Platform.OS === 'ios') setShowPicker(false);
    }
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
      {/* Sticky header — sits outside FlatList so no ScrollView z-index conflicts */}
      <View style={styles.stickyHeader}>
        <View style={styles.dateNav}>
          <Pressable onPress={prevDay} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </Pressable>
          <Pressable onPress={() => setShowPicker((v) => !v)} style={styles.dateLabelBtn}>
            <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
            <Ionicons name="calendar-outline" size={14} color="#9ca3af" style={{ marginLeft: 4 }} />
          </Pressable>
          <Pressable
            onPress={nextDay}
            style={[styles.navBtn, isToday && styles.navBtnDisabled]}
            disabled={isToday}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={20} color={isToday ? '#d1d5db' : '#374151'} />
          </Pressable>
        </View>

        {/*
         * Picker rendered inline — no Modal.
         * Web:     <input type="date"> — small but visible; browser popup handles layering.
         * iOS:     display="inline" shows a full month-grid calendar (~350 px tall).
         * Android: display="default" opens a system dialog regardless of position.
         */}
        {showPicker && (
          <View style={[styles.pickerPanel, Platform.OS === 'ios' && styles.pickerPanelIOS]}>
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={today}
              style={Platform.OS === 'ios' ? styles.iosPicker : styles.webPicker}
              onChange={handlePickerChange}
            />
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {CHIPS.map((chip) => {
            const active = activeFilter === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setActiveFilter(chip.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
        data={visibleEntries}
        keyExtractor={(item) => item.id}
        numColumns={isTablet ? 2 : 1}
        key={isTablet ? 'tablet' : 'phone'}
        columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
        ListEmptyComponent={<Text style={styles.empty}>No events for this day.</Text>}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <LogCard
            entry={item}
            carerNames={carerNames}
            wide={isTablet}
            onPress={setSelectedEntry}
          />
        )}
      />

      <Modal
        visible={!!selectedEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View style={styles.detailOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelectedEntry(null)} />
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            {selectedEntry &&
              (() => {
                const cfg = EVENT_CONFIG[selectedEntry.event_type];
                const statusBadge = STATUS_BADGE[selectedEntry.status];
                const carerName = selectedEntry.carer_id
                  ? carerNames[selectedEntry.carer_id]
                  : null;
                const description =
                  selectedEntry.scheduled_item?.description ??
                  selectedEntry.prn_medication?.notes ??
                  null;
                return (
                  <>
                    <Text style={styles.detailTypeLabel}>{cfg.label}</Text>
                    <Text style={styles.detailName}>{entryName(selectedEntry)}</Text>
                    <Text style={styles.detailTime}>{formatTime(selectedEntry.occurred_at)}</Text>
                    <View style={[styles.detailBadge, { backgroundColor: statusBadge.bg }]}>
                      <Text style={[styles.detailBadgeText, { color: statusBadge.color }]}>
                        {statusBadge.label}
                      </Text>
                    </View>
                    {carerName ? (
                      <Text style={styles.detailCarer}>
                        {selectedEntry.status === 'completed'
                          ? 'By'
                          : selectedEntry.status === 'skipped'
                            ? 'Skipped by'
                            : ''}{' '}
                        {carerName}
                      </Text>
                    ) : null}
                    {description ? (
                      <View style={[styles.detailDescBox, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.detailDescText, { color: cfg.color }]}>
                          {description}
                        </Text>
                      </View>
                    ) : null}
                    {selectedEntry.notes ? (
                      <View style={styles.detailNotesBox}>
                        <Text style={styles.detailNotesLabel}>Notes</Text>
                        <Text style={styles.detailNotesText}>{selectedEntry.notes}</Text>
                      </View>
                    ) : null}
                    {!description && !selectedEntry.notes ? (
                      <Text style={styles.detailEmpty}>No description or notes</Text>
                    ) : null}
                  </>
                );
              })()}
            <Pressable style={styles.detailCloseBtn} onPress={() => setSelectedEntry(null)}>
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

  /* Sticky header */
  stickyHeader: {
    backgroundColor: '#f9fafb',
    paddingTop: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  /* Date nav */
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  navBtnDisabled: { opacity: 0.35 },
  dateLabelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },

  /* Inline picker panel */
  pickerPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    padding: 8,
    alignItems: 'center',
  },
  pickerPanelIOS: {
    // Extra height to accommodate the iOS inline calendar grid
    paddingVertical: 0,
  },
  iosPicker: { width: '100%', height: 350 },
  webPicker: { width: '100%' },

  /* Filter chips */
  chipsScroll: { marginBottom: 12 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  /* Entries list */
  listContent: { padding: 16, paddingBottom: 32 },
  listContentTablet: { paddingHorizontal: 24 },
  columnWrapper: { gap: 12 },

  /* Log card */
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    flex: 1,
  },
  cardWide: { marginBottom: 0 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  cardName: { fontSize: 14, fontWeight: '500', color: '#111827', flexShrink: 1 },
  cardTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cardCarer: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  cardCarerMissed: { fontSize: 11, color: '#dc2626', marginTop: 2 },
  cardNotes: { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },

  /* Badges */
  badge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  badgePRN: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  badgeCatchUp: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },

  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48, fontSize: 14 },
  cardPressed: { opacity: 0.85 },

  /* Detail sheet */
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
  detailTime: { fontSize: 13, color: '#9ca3af', marginBottom: 8 },
  detailBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 4,
  },
  detailBadgeText: { fontSize: 11, fontWeight: '600' },
  detailCarer: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  detailDescBox: { borderRadius: 8, padding: 10, marginTop: 12 },
  detailDescText: { fontSize: 14, lineHeight: 20 },
  detailNotesBox: { marginTop: 12 },
  detailNotesLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  detailNotesText: { fontSize: 14, color: '#374151', lineHeight: 20, fontStyle: 'italic' },
  detailEmpty: { fontSize: 14, color: '#9ca3af', marginTop: 16, fontStyle: 'italic' },
  detailCloseBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 16 },
  detailCloseBtnText: { color: '#6b7280', fontSize: 15 },
});
