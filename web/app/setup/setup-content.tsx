'use client';

import { useEffect, useState, useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { setPassword } from '@/app/actions/auth';

export default function SetupContent() {
  const searchParams = useSearchParams();
  const [exchanged, setExchanged] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(setPassword, undefined);

  useEffect(() => {
    const code = searchParams.get('code');
    const fakeError = code ? null : 'No invite code found. Please check your invite email.';
    const exchange = code
      ? createClient().auth.exchangeCodeForSession(code)
      : Promise.resolve({ data: null, error: { message: fakeError! } as Error });

    exchange.then(({ error }) => {
      if (error) {
        setExchangeError(error.message);
      } else {
        setExchanged(true);
        window.history.replaceState({}, '', '/setup');
      }
    });
  }, [searchParams]);

  if (exchangeError) {
    return (
      <div className="w-full max-w-sm space-y-2 text-center">
        <p className="text-sm text-red-600">{exchangeError}</p>
        <p className="text-sm text-neutral-500">
          Please request a new invite from your care coordinator.
        </p>
      </div>
    );
  }

  if (!exchanged) {
    return <p className="text-sm text-neutral-500">Verifying your invite…</p>;
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set your password</h1>
        <p className="text-sm text-neutral-500">
          Choose a password to complete your account setup.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm" className="text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? 'Setting password…' : 'Set password'}
        </button>
      </form>
    </div>
  );
}
