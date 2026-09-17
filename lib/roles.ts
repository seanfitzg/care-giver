import type { UserRole } from '@/contexts/AuthContext';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  senior_carer: 'Senior Carer',
  carer: 'Carer',
};
