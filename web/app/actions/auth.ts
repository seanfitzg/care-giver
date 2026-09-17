'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

async function getOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  if (origin) return origin;
  const host = requestHeaders.get('host') ?? '';
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

function validatePasswordConfirmation(password: string, confirm: string): string | null {
  if (password !== confirm) return 'Passwords do not match';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

export async function login(_state: { error?: string } | undefined, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });
  if (error) return { error: error.message };
  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function setPassword(_state: { error?: string } | undefined, formData: FormData) {
  const password = formData.get('password') as string;
  const confirm = formData.get('confirm') as string;

  const validationError = validatePasswordConfirmation(password, confirm);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect('/');
}

export async function signup(
  _state: { error?: string; success?: boolean } | undefined,
  formData: FormData,
) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirm = formData.get('confirm') as string;

  const validationError = validatePasswordConfirmation(password, confirm);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${await getOrigin()}/setup?type=signup`,
    },
  });

  if (error) return { error: error.message };

  // When email confirmations are required, Supabase returns a user with no
  // identities (instead of an error) for an email that's already registered,
  // to prevent account enumeration by default. This app deliberately opts
  // out of that obscuring — see #107's policy decision — and surfaces it.
  if (data.user && data.user.identities?.length === 0) {
    return { error: 'This email is already registered. Log in instead.' };
  }

  return { success: true };
}
