import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Carer management' }} />
      <Stack.Screen name="schedule" options={{ title: 'Schedule' }} />
    </Stack>
  );
}
