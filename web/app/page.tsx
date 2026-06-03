import { logout } from '@/app/actions/auth';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-4">
      <h1 className="text-2xl font-semibold">care-giver</h1>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
