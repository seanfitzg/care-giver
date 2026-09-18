'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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

export async function selectActivePatient(formData: FormData) {
  const careRecipientId = formData.get('careRecipientId');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (typeof careRecipientId !== 'string') redirect('/picker');

  const { allPatients } = await getActivePatient(user.id);
  if (!allPatients.some((patient) => patient.careRecipientId === careRecipientId)) {
    redirect('/picker');
  }

  await setActivePatientCookie(careRecipientId);
  redirect('/');
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
