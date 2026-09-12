export const ROLE_HOME: Record<string, string> = {
  superadmin: '/admin',
  organizer: '/admin',
  cashier: '/caixa',
  treasurer: '/caixa',
  bar: '/cozinha',
  kitchen: '/cozinha',
  client: '/pedidos',
};

export function homeForRole(role?: string | null): string {
  if (!role) {
    return '/';
  }
  return ROLE_HOME[role] ?? '/';
}

export function isStaffRole(role?: string | null): boolean {
  return Boolean(role) && role !== 'client';
}

export function isFinanceRole(role?: string | null): boolean {
  return ['superadmin', 'organizer', 'cashier', 'treasurer'].includes(role ?? '');
}

export function isManagementRole(role?: string | null): boolean {
  return ['superadmin', 'organizer'].includes(role ?? '');
}
