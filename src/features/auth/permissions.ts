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

const roleRank = new Map([
  ['owner', 0],
  ['ceo-co-owner-super-admin', 1],
  ['admin', 2],
  ['manager', 3],
  ['support-agent', 4],
  ['developer', 5],
  ['customer', 7],
]);

export function compareRoleRank(
  a: { slug: string; name: string },
  b: { slug: string; name: string },
) {
  return (roleRank.get(a.slug) ?? 6) - (roleRank.get(b.slug) ?? 6) || a.name.localeCompare(b.name);
}
