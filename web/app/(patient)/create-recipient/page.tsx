'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createCareRecipient } from '@/app/actions/patients';

export default function CreateRecipientPage() {
  const [state, action, pending] = useActionState(createCareRecipient, undefined);

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up a care profile</h1>
        <p className="text-sm text-neutral-500">
          Enter the care recipient&apos;s details to get started. You&apos;ll be assigned as admin.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="dateOfBirth" className="text-sm font-medium">
            Date of birth
          </label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            required
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
          {pending ? 'Creating…' : 'Create profile'}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-500">
        <Link href="/pending" className="font-medium text-neutral-900 hover:underline">
          Back
        </Link>
      </p>
    </div>
  );
}
