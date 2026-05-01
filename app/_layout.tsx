import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { DutyProvider } from '@/contexts/DutyContext';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DutyProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DutyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
