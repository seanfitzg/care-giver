import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, allPatients, activePatient } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onInviteSetup = inAuthGroup && segments[1] === 'setup';
    const inSetupGroup = segments[0] === '(setup)';
    const inPatientGroup = segments[0] === '(patient)';
    const onPendingScreen = inPatientGroup && segments[1] === 'pending';
    const onPickerScreen = inPatientGroup && segments[1] === 'picker';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login' as never);
      return;
    }

    if (onInviteSetup) return;

    // Zero patient assignments: either a brand-new user waiting to be added to a
    // care team, or an admin who hasn't created a care recipient yet. The pending
    // screen offers a path into (setup)/create-recipient for the latter case, since
    // the data alone can't distinguish the two.
    if (allPatients.length === 0) {
      if (!inSetupGroup && !onPendingScreen) router.replace('/(patient)/pending' as never);
      return;
    }

    if (!activePatient) {
      if (!onPickerScreen) router.replace('/(patient)/picker' as never);
      return;
    }

    // (setup)/create-recipient and (patient)/picker are also voluntary
    // destinations once an active patient is set — reached from "Start a new
    // team" / "Manage teams" inside the app — so they're exempt from the
    // bounce-back-to-tabs redirect below that otherwise guards onboarding.
    if (inAuthGroup) {
      router.replace('/(tabs)');
    } else if (inPatientGroup && !onPickerScreen) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router, allPatients, activePatient]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
