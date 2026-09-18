import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActivePatient } from '@/lib/patients';
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

  const { activePatient } = await getActivePatient(user.id);
  const dob = activePatient?.careRecipientDateOfBirth;

  return (
    <AppShell
      email={user.email ?? ''}
      role={activePatient?.role ?? 'carer'}
      careRecipientName={activePatient?.careRecipientName ?? ''}
      careRecipientAge={dob ? calcAge(dob) : null}
    >
      {children}
    </AppShell>
  );
}
