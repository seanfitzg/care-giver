import { Suspense } from 'react';
import SetupContent from './setup-content';

export default function SetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <SetupContent />
      </Suspense>
    </main>
  );
}
