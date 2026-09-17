import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { validatePasswordConfirmation } from '@/lib/validation';

const NATIVE_REDIRECT = 'caregiver://setup';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Please enter your name and email.');
      return;
    }
    const validationError = validatePasswordConfirmation(password, confirm);
    if (validationError) {
      Alert.alert(validationError);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: NATIVE_REDIRECT,
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    // When email confirmations are required, Supabase returns a user with no
    // identities (instead of an error) for an email that's already registered,
    // to prevent account enumeration by default. This app deliberately opts
    // out of that obscuring — see #107's policy decision — and surfaces it.
    if (data.user && data.user.identities?.length === 0) {
      Alert.alert('This email is already registered', 'Log in instead.');
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We&apos;ve sent a confirmation link to your email address. Follow it to finish creating
          your account.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.formTitle}>Create your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#9ca3af"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          textContentType="newPassword"
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
});
