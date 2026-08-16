export type CarerUserRole = 'admin' | 'senior_carer' | 'carer';

export interface CarerRow {
  id: string;
  user_id: string;
  role: CarerUserRole;
  email: string | null;
  last_sign_in_at: string | null;
}

export function roleLabel(role: string): string {
  if (role === 'admin') return 'Admin';
  if (role === 'senior_carer') return 'Senior Carer';
  return 'Carer';
}

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
