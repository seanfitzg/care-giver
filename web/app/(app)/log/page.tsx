import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogTable from './LogTable';
import { LOG_ENTRY_COLUMNS, PAGE_SIZE, type LogEntry } from './types';

export default async function LogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, care_recipient_id')
    .eq('user_id', user.id)
    .single();

  const careRecipientId = roleData?.care_recipient_id;

  if (!careRecipientId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Care log</h1>
        <p className="mt-2 text-sm text-neutral-500">No care recipient assigned to your account.</p>
      </div>
    );
  }

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
