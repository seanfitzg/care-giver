export function roleLabel(role: string): string {
  if (role === 'admin') return 'Admin';
  if (role === 'senior_carer') return 'Senior Carer';
  return 'Carer';
}
