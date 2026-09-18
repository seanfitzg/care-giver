import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActivePatient } from '@/lib/patients';
import AsNeededMedicationsTable from './AsNeededMedicationsTable';
import CarerTable from './CarerTable';
import type { CarerRow } from './types';
import type { PRNMedication } from '../components/types';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { activePatient } = await getActivePatient(user.id);

  if (activePatient?.role !== 'admin' && activePatient?.role !== 'senior_carer') redirect('/');

  const careRecipientId = activePatient.careRecipientId;
  const currentUserRole = activePatient.role;

  const [carersResult, medicationsResult] = await Promise.all([
    supabase.rpc('get_carers_with_emails', {
      p_care_recipient_id: careRecipientId,
    }),
    supabase
      .from('as_needed_medications')
      .select('id, name, notes')
      .eq('care_recipient_id', careRecipientId)
      .order('name', { ascending: true }),
  ]);

  return (
    <>
      <CarerTable
        careRecipientId={careRecipientId}
        currentUserId={user.id}
        currentUserRole={currentUserRole}
        initialCarers={(carersResult.data ?? []) as CarerRow[]}
      />
      <div style={{ marginTop: 32 }}>
        <AsNeededMedicationsTable
          careRecipientId={careRecipientId}
          currentUserId={user.id}
          initialMedications={(medicationsResult.data ?? []) as PRNMedication[]}
        />
      </div>
    </>
  );
}
