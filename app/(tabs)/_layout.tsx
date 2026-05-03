import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

const TAB_TITLES: Record<string, string> = {
  index: 'Today',
  feed: 'Feed',
  'on-duty': 'On Duty',
  log: 'Log',
};

export default function TabLayout() {
  const { isAdmin, careRecipientName } = useAuth();

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
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#2563eb',
        headerShown: true,
        headerRight: adminHeaderRight,
        headerTitle: () => (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827' }}>
              {TAB_TITLES[route.name] ?? route.name}
            </Text>
            {careRecipientName ? (
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                {careRecipientName}
              </Text>
            ) : null}
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="on-duty" options={{ title: 'On Duty' }} />
      <Tabs.Screen name="log" options={{ title: 'Log' }} />
    </Tabs>
  );
}
