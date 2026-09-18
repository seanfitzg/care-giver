import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActivePatient } from '@/lib/patients';
import ScheduleTable from './ScheduleTable';
import { SCHEDULED_ITEM_COLUMNS } from './types';

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { activePatient } = await getActivePatient(user.id);
  const careRecipientId = activePatient?.careRecipientId;
  const canManage = activePatient?.role === 'admin' || activePatient?.role === 'senior_carer';

  if (!careRecipientId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Schedule</h1>
        <p className="mt-2 text-sm text-neutral-500">No care recipient assigned to your account.</p>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('scheduled_items')
    .select(SCHEDULED_ITEM_COLUMNS)
    .eq('care_recipient_id', careRecipientId)
    .order('name', { ascending: true });

  return (
    <ScheduleTable
      careRecipientId={careRecipientId}
      userId={user.id}
      initialItems={items ?? []}
      canManage={canManage}
    />
  );
}
