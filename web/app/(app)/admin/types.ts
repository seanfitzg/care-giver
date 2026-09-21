export type CarerUserRole = 'admin' | 'senior_carer' | 'carer';

export interface CarerRow {
  id: string;
  user_id: string;
  role: CarerUserRole;
  email: string | null;
  name: string | null;
  last_sign_in_at: string | null;
}

export { roleLabel } from '@/lib/roleLabel';

export function formatLastSignIn(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
