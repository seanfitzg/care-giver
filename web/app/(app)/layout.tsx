import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from './components/AppShell';

function calcAge(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, care_recipients(name, date_of_birth)')
    .eq('user_id', user.id)
    .single();

  const role = roleData?.role ?? 'carer';
  const recipient = Array.isArray(roleData?.care_recipients)
    ? roleData.care_recipients[0]
    : roleData?.care_recipients;

  return (
    <AppShell
      email={user.email ?? ''}
      role={role}
      careRecipientName={recipient?.name ?? ''}
      careRecipientAge={recipient?.date_of_birth ? calcAge(recipient.date_of_birth) : null}
    >
      {children}
    </AppShell>
  );
}
