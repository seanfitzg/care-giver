import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type UserRole = 'admin' | 'senior_carer' | 'carer';

export type PatientAssignment = {
  careRecipientId: string;
  careRecipientName: string | null;
  careRecipientDateOfBirth: string | null;
  role: UserRole;
};

export const ACTIVE_PATIENT_COOKIE = 'active-care-recipient-id';

export async function getAllPatients(
  supabase: SupabaseClient,
  userId: string,
): Promise<PatientAssignment[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, care_recipient_id, care_recipients(name, date_of_birth)')
    .eq('user_id', userId);
  if (error || !data) return [];

  return data.map((row) => {
    const careRecipient = Array.isArray(row.care_recipients)
      ? row.care_recipients[0]
      : row.care_recipients;

    return {
      careRecipientId: row.care_recipient_id,
      careRecipientName: careRecipient?.name ?? null,
      careRecipientDateOfBirth: careRecipient?.date_of_birth ?? null,
      role: row.role as UserRole,
    };
  });
}

export function resolveActivePatient(
  patients: PatientAssignment[],
  storedId: string | undefined,
): PatientAssignment | null {
  // A single assignment is unambiguous — select it even with no (or a stale)
  // cookie, so existing single-patient accounts see no behaviour change ahead
  // of the picker/switcher UI (#101, #102) that lets multi-patient users
  // choose explicitly.
  if (patients.length === 1) return patients[0];
  if (!storedId) return null;
  return patients.find((patient) => patient.careRecipientId === storedId) ?? null;
}

// Memoized per request: layout.tsx and the page it wraps both resolve the
// active patient independently, and without `cache()` that's a duplicate
// user_roles/care_recipients round-trip on every navigation.
export const getActivePatient = cache(async (userId: string) => {
  const supabase = await createClient();
  const allPatients = await getAllPatients(supabase, userId);
  const cookieStore = await cookies();
  const storedId = cookieStore.get(ACTIVE_PATIENT_COOKIE)?.value;
  return { allPatients, activePatient: resolveActivePatient(allPatients, storedId) };
});

// Resolves the active patient or redirects to /pending or /picker, whichever
// applies. Every (app)/ route calls this independently (not just the shared
// layout) since a shared layout isn't guaranteed to re-run on every
// client-side navigation between its sibling pages.
export async function requireActivePatient(userId: string): Promise<PatientAssignment> {
  const { allPatients, activePatient } = await getActivePatient(userId);
  if (!activePatient) redirect(allPatients.length === 0 ? '/pending' : '/picker');
  return activePatient;
}
