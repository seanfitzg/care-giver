import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today' }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: 'Feed' }}
      />
      <Tabs.Screen
        name="on-duty"
        options={{ title: 'On Duty' }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'Log' }}
      />
    </Tabs>
  );
}
