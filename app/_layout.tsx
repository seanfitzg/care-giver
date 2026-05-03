import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DutyProvider } from '@/contexts/DutyContext';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, careRecipientId } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onInviteSetup = inAuthGroup && segments[1] === 'setup';
    const inSetupGroup = segments[0] === '(setup)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login' as never);
      return;
    }

    if (onInviteSetup) return;

    if (!careRecipientId) {
      if (!inSetupGroup) router.replace('/(setup)/create-recipient' as never);
      return;
    }

    if (inAuthGroup || inSetupGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router, careRecipientId]);

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
        <DutyProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </DutyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
