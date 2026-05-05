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
  const { isAdmin, role, careRecipientName, signOut } = useAuth();

  const settingsHref = isAdmin ? '/admin' : '/admin/schedule';
  const settingsHeaderRight =
    isAdmin || role === 'senior_carer'
      ? () => (
          <Link href={settingsHref as never} asChild>
            <Pressable style={{ marginRight: 16 }} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={22} color="#374151" />
            </Pressable>
          </Link>
        )
      : undefined;

  const headerLeft = () => (
    <Pressable style={{ marginLeft: 16 }} onPress={signOut} accessibilityLabel="Sign out">
      <Ionicons name="log-out-outline" size={22} color="#374151" />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#2563eb',
        headerShown: true,
        headerLeft,
        headerRight: settingsHeaderRight,
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="on-duty"
        options={{
          title: 'On Duty',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
