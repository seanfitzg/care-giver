import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireActivePatient } from '@/lib/patients';
import ScheduleTable from './ScheduleTable';
import { SCHEDULED_ITEM_COLUMNS } from './types';

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { careRecipientId, role } = await requireActivePatient(user.id);
  const canManage = role === 'admin' || role === 'senior_carer';

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
