import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActivePatient } from '@/lib/patients';
import { selectActivePatient } from '@/app/actions/patients';

function roleLabel(role: string): string {
  if (role === 'admin') return 'Admin';
  if (role === 'senior_carer') return 'Senior Carer';
  return 'Carer';
}

export default async function PatientPickerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { allPatients } = await getActivePatient(user.id);

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a patient</h1>
        <p className="text-sm text-neutral-500">Select who you&apos;re caring for right now.</p>
      </div>

      <div className="space-y-2">
        {allPatients.map((patient) => (
          <form key={patient.careRecipientId} action={selectActivePatient}>
            <input type="hidden" name="careRecipientId" value={patient.careRecipientId} />
            <button
              type="submit"
              className="w-full rounded-md border border-neutral-300 px-4 py-3 text-left text-sm hover:border-neutral-500"
            >
              <div className="font-medium text-neutral-900">
                {patient.careRecipientName ?? 'Unnamed patient'}
              </div>
              <div className="text-xs text-neutral-500">{roleLabel(patient.role)}</div>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
