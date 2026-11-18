export const modulePermissions: Record<string, string> = {
  orders: 'orders.read',
  menu: 'menu.read',
  customers: 'customers.read',
  staff: 'staff.read',
  roles: 'roles.read',
  support: 'support.read',
  reports: 'reports.read',
  activity: 'audit.read',
  settings: 'settings.read',
  website: 'website.manage',
};
export function visibleModule(slug: string, permissions: readonly string[]) {
  return (
    permissions.includes(modulePermissions[slug]) ||
    (slug === 'people' &&
      permissions.includes('people.read') &&
      permissions.some(
        (permission) => permission === 'staff.read' || permission === 'customers.read',
      )) ||
    (slug === 'menu' && permissions.includes('menu.manage')) ||
    (slug === 'settings' && permissions.includes('settings.manage'))
  );
}
