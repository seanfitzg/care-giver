import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCareLogs } from '@/hooks/useCareLogs';
import type { CareLogEntry } from '@/hooks/useCareLogs';

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
  missed: { icon: 'alert-circle-outline', color: '#dc2626', bg: '#fef2f2', label: 'Missed' },
};

const STATUS_COLOR: Record<CareLogEntry['status'], string> = {
  completed: '#16a34a',
  missed: '#dc2626',
  skipped: '#6b7280',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `Yesterday ${time}`;

  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${time}`;
}

function entryName(entry: CareLogEntry): string {
  if (entry.prn_medication?.name) return entry.prn_medication.name;
  if (entry.scheduled_item?.name) return entry.scheduled_item.name;
  return entry.event_type.replace(/_/g, ' ');
}

function LogCard({
  entry,
  carerNames,
}: {
  entry: CareLogEntry;
  carerNames: Record<string, string>;
}) {
  const cfg = EVENT_CONFIG[entry.event_type];
  const carerName = entry.carer_id ? carerNames[entry.carer_id] : null;
  const isPRN = entry.event_type === 'as_needed_medication';

  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {entryName(entry)}
          </Text>
          {isPRN && (
            <View style={styles.prnBadge}>
              <Text style={styles.prnBadgeText}>PRN</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTime}>{formatDateTime(entry.occurred_at)}</Text>
        {carerName ? (
          <Text style={[styles.cardCarer, { color: STATUS_COLOR[entry.status] }]}>
            {entry.status === 'completed' ? 'By' : entry.status} {carerName}
          </Text>
        ) : null}
        {entry.notes ? <Text style={styles.cardNotes}>{entry.notes}</Text> : null}
      </View>
    </View>
  );
}

export default function LogScreen() {
  const { careRecipientId } = useAuth();
  const { data, isLoading, refetch } = useCareLogs(careRecipientId);

  const entries = data?.entries ?? [];
  const carerNames = data?.carerNames ?? {};

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <Text style={styles.windowLabel}>Last 7 days</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>No events recorded yet.</Text>
      ) : (
        entries.map((entry) => (
          <LogCard key={entry.id} entry={entry} carerNames={carerNames} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  windowLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48, fontSize: 14 },

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
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardName: { fontSize: 14, fontWeight: '500', color: '#111827', flexShrink: 1 },
  cardTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cardCarer: { fontSize: 11, marginTop: 2 },
  cardNotes: { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },

  prnBadge: {
    backgroundColor: '#f5f3ff',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  prnBadgeText: { fontSize: 10, fontWeight: '700', color: '#7c3aed', letterSpacing: 0.5 },
});
