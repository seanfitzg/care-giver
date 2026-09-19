'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_PATIENT_COOKIE, getActivePatient } from '@/lib/patients';

const ACTIVE_PATIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

async function setActivePatientCookie(careRecipientId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PATIENT_COOKIE, careRecipientId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACTIVE_PATIENT_COOKIE_MAX_AGE,
  });
}

// Shared by selectActivePatient and switchActivePatient: confirms the caller
// is signed in and the given id is one of their own patients, so a stale or
// tampered-with id can't be adopted as the active patient by either entry
// point.
async function isOwnPatient(careRecipientId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { allPatients } = await getActivePatient(user.id);
  return allPatients.some((patient) => patient.careRecipientId === careRecipientId);
}

export async function selectActivePatient(formData: FormData) {
  const careRecipientId = formData.get('careRecipientId');

  if (typeof careRecipientId !== 'string' || !(await isOwnPatient(careRecipientId))) {
    redirect('/picker');
  }

  await setActivePatientCookie(careRecipientId);
  redirect('/');
}

// Sidebar switcher variant of selectActivePatient: no redirect, since the
// user is already inside the app and should stay on the page they're on —
// revalidatePath refreshes it in place with the newly active patient's data.
export async function switchActivePatient(careRecipientId: string) {
  if (!(await isOwnPatient(careRecipientId))) return;

  await setActivePatientCookie(careRecipientId);
  revalidatePath('/', 'layout');
}

export async function createCareRecipient(
  _state: { error?: string } | undefined,
  formData: FormData,
) {
  const name = (formData.get('name') as string)?.trim();
  const dateOfBirth = formData.get('dateOfBirth') as string;

  if (!name) return { error: 'Please enter a name.' };
  if (!dateOfBirth) return { error: 'Please enter a date of birth.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: careRecipientId, error } = await supabase.rpc('create_care_recipient', {
    p_name: name,
    p_date_of_birth: dateOfBirth,
  });
  if (error || !careRecipientId) {
    return { error: 'Could not create care profile — please try again.' };
  }

  await setActivePatientCookie(careRecipientId);
  redirect('/');
}
