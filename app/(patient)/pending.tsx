import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function PendingScreen() {
  const { refresh, signOut } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Waiting to be added</Text>
        <Text style={styles.subtitle}>
          You&rsquo;re not currently on a care team. Ask an admin to invite you, or set up a new
          care profile of your own.
        </Text>

        <Pressable
          style={[styles.button, refreshing && styles.buttonDisabled]}
          onPress={handleRefresh}
          disabled={refreshing}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{refreshing ? 'Checking…' : 'Check again'}</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(setup)/create-recipient')}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Set up a new care profile</Text>
        </Pressable>

        <Pressable onPress={signOut} style={styles.signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 28,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  signOut: {
    alignSelf: 'center',
    paddingTop: 8,
  },
  signOutText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
