import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireActivePatient } from '@/lib/patients';
import LogTable from './LogTable';
import { LOG_ENTRY_COLUMNS, PAGE_SIZE, type LogEntry } from './types';

export default async function LogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activePatient = await requireActivePatient(user.id);
  const careRecipientId = activePatient.careRecipientId;

  const { data: initialEntries, count } = await supabase
    .from('event_log')
    .select(LOG_ENTRY_COLUMNS, { count: 'exact' })
    .eq('care_recipient_id', careRecipientId)
    .order('occurred_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  return (
    <LogTable
      careRecipientId={careRecipientId}
      initialEntries={(initialEntries ?? []) as LogEntry[]}
      initialCount={count ?? 0}
    />
  );
}
