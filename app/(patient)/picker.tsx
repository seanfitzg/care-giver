import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/roles';

export default function PatientPickerScreen() {
  const { allPatients, setActivePatient, signOut } = useAuth();
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
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => handleSelect(item.careRecipientId)}
            accessibilityRole="button"
          >
            <Text style={styles.cardName}>{item.careRecipientName ?? 'Unnamed patient'}</Text>
            <Text style={styles.cardRole}>{ROLE_LABELS[item.role]}</Text>
          </Pressable>
        )}
      />

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
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardPressed: {
    backgroundColor: '#f3f4f6',
  },
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
  signOut: {
    alignSelf: 'center',
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
