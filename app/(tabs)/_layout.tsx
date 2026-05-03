import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { isAdmin } = useAuth();

  const adminHeaderRight = isAdmin
    ? () => (
        <Link href={'/admin' as never} asChild>
          <Pressable style={{ marginRight: 16 }} accessibilityLabel="Carer management">
            <Ionicons name="settings-outline" size={22} color="#374151" />
          </Pressable>
        </Link>
      )
    : undefined;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        headerShown: true,
        headerRight: adminHeaderRight,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="on-duty" options={{ title: 'On Duty' }} />
      <Tabs.Screen name="log" options={{ title: 'Log' }} />
    </Tabs>
  );
}
