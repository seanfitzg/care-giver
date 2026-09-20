import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/roles';

export default function PatientPickerScreen() {
  const { allPatients, careRecipientId, setActivePatient, signOut } = useAuth();
  const router = useRouter();

  const handleSelect = async (careRecipientId: string) => {
    await setActivePatient(careRecipientId);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a patient</Text>
      <Text style={styles.subtitle}>Select who you&rsquo;re caring for right now.</Text>

      <FlatList
        data={allPatients}
        keyExtractor={(item) => item.careRecipientId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isActive = item.careRecipientId === careRecipientId;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                isActive && styles.cardActive,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(item.careRecipientId)}
              accessibilityRole="button"
            >
              <View style={styles.cardText}>
                <Text style={styles.cardName}>{item.careRecipientName ?? 'Unnamed patient'}</Text>
                <Text style={styles.cardRole}>{ROLE_LABELS[item.role]}</Text>
              </View>
              {isActive && <Ionicons name="checkmark" size={20} color="#2563eb" />}
            </Pressable>
          );
        }}
      />

      <Pressable
        style={styles.startTeam}
        onPress={() => router.push('/(setup)/create-recipient')}
        accessibilityRole="button"
      >
        <Text style={styles.startTeamText}>Start a new team</Text>
      </Pressable>

      <Pressable onPress={signOut} style={styles.signOut} accessibilityRole="button">
        <Text style={styles.signOutText}>Not you? Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingTop: 72,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  cardPressed: {
    backgroundColor: '#f3f4f6',
  },
  cardText: { flex: 1 },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardRole: {
    fontSize: 13,
    color: '#6b7280',
  },
  startTeam: {
    alignSelf: 'center',
    paddingTop: 20,
  },
  startTeamText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  signOut: {
    alignSelf: 'center',
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
