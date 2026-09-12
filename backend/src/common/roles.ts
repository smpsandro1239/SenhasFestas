export const ROLES = [
  'superadmin',
  'organizer',
  'cashier',
  'bar',
  'kitchen',
  'treasurer',
  'client',
] as const;

export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ROLES.filter((role) => role !== 'client');

export const MANAGEMENT_ROLES = ['superadmin', 'organizer'];

export const FINANCE_ROLES = ['superadmin', 'organizer', 'cashier', 'treasurer'];

export const KITCHEN_ROLES = ['superadmin', 'organizer', 'kitchen', 'bar'];

export const ORDER_CREATOR_ROLES = ['superadmin', 'organizer', 'cashier', 'treasurer', 'client'];

export const AUDIT_ROLES = ['superadmin', 'organizer', 'treasurer'];