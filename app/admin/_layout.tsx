import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      style={{ marginLeft: 8 }}
      accessibilityLabel="Back"
    >
      <Ionicons name="arrow-back" size={24} color="#374151" />
    </Pressable>
  );
}

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Carer management', headerLeft: () => <BackButton /> }}
      />
    </Stack>
  );
}
