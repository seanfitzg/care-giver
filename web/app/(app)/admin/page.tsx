import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CarerTable from './CarerTable';
import type { CarerRow } from './types';

export default async function AdminPage() {
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

  if (roleData?.role !== 'admin') redirect('/');

  const careRecipientId = roleData.care_recipient_id;

  const { data: carers } = await supabase.rpc('get_carers_with_emails', {
    p_care_recipient_id: careRecipientId,
  });

  return (
    <CarerTable
      careRecipientId={careRecipientId}
      currentUserId={user.id}
      initialCarers={(carers ?? []) as CarerRow[]}
    />
  );
}
