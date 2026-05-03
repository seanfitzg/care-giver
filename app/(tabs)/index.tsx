import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useDuty } from '@/contexts/DutyContext';

export default function TodayScreen() {
  const { isAdmin } = useAuth();
  const { isOnDuty, loading, checkIn, checkOut } = useDuty();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.placeholder}>Timeline view coming soon</Text>

      {!isAdmin && (
        <Pressable
          style={[styles.fab, isOnDuty ? styles.fabOut : styles.fabIn]}
          onPress={isOnDuty ? checkOut : checkIn}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.fabText}>{isOnDuty ? 'Check out' : 'Check in'}</Text>
          }
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  placeholder: { color: '#6b7280' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  fabIn: { backgroundColor: '#2563eb' },
  fabOut: { backgroundColor: '#dc2626' },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
