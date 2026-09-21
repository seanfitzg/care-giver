import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActivePatient } from '@/lib/patients';
import PickerList from './PickerList';

export default async function PatientPickerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { allPatients, activePatient } = await getActivePatient(user.id);

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a patient</h1>
        <p className="text-sm text-neutral-500">Select who you&apos;re caring for right now.</p>
      </div>

      <PickerList
        initialPatients={allPatients}
        activePatientId={activePatient?.careRecipientId ?? null}
      />

      <Link
        href="/create-recipient"
        className="block w-full text-sm font-medium text-neutral-900 hover:underline"
      >
        Start a new team
      </Link>
    </div>
  );
}
