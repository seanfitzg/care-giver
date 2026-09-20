import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PatientSwitcherSheet } from '@/components/PatientSwitcherSheet';
import { useAuth } from '@/contexts/AuthContext';

const TAB_TITLES: Record<string, string> = {
  index: 'Today',
  schedule: 'Schedule',
  log: 'Log',
};

export default function TabLayout() {
  const {
    isAdmin,
    role,
    allPatients,
    careRecipientId,
    careRecipientName,
    setActivePatient,
    signOut,
  } = useAuth();
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const router = useRouter();

  const handleSelectPatient = async (id: string) => {
    setSwitcherVisible(false);
    await setActivePatient(id);
  };

  const handleManageTeams = () => {
    setSwitcherVisible(false);
    router.push('/(patient)/picker');
  };

  const settingsHref = '/admin';
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
    <>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#2563eb',
          headerShown: true,
          headerLeft,
          headerRight: settingsHeaderRight,
          headerTitle: () => (
            <Pressable
              style={{ alignItems: 'center' }}
              onPress={() => setSwitcherVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Switch patient"
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827' }}>
                {TAB_TITLES[route.name] ?? route.name}
              </Text>
              {careRecipientName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>{careRecipientName}</Text>
                  <Ionicons name="chevron-down" size={12} color="#6b7280" />
                </View>
              ) : null}
            </Pressable>
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
          name="schedule"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
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
      <PatientSwitcherSheet
        visible={switcherVisible}
        patients={allPatients}
        activeCareRecipientId={careRecipientId}
        onSelect={handleSelectPatient}
        onManageTeams={handleManageTeams}
        onDismiss={() => setSwitcherVisible(false)}
      />
    </>
  );
}
