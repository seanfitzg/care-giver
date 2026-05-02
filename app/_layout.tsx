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
    const onSetupScreen = segments[1] === 'setup';
    const onCreateScreen = segments[1] === 'create-care-recipient';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login' as never);
      return;
    }
    // Invite setup flow — let it run without interference.
    if (onSetupScreen) return;
    // Authenticated but no care recipient — prompt to create one.
    if (!careRecipientId) {
      if (!onCreateScreen) router.replace('/(auth)/create-care-recipient' as never);
      return;
    }
    // Fully authenticated — leave auth screens.
    if (inAuthGroup) router.replace('/(tabs)' as never);
  }, [session, loading, careRecipientId, segments, router]);

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
