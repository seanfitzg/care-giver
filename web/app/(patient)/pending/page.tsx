import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Waiting to be added</h1>
        <p className="text-sm text-neutral-500">
          You&apos;re not currently on a care team. Ask an admin to invite you, or set up a new care
          profile of your own.
        </p>
      </div>

      <div className="space-y-2">
        <Link
          href="/"
          className="block w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Check again
        </Link>
        <Link
          href="/create-recipient"
          className="block w-full text-sm font-medium text-neutral-900 hover:underline"
        >
          Set up a new care profile
        </Link>
      </div>
    </div>
  );
}
