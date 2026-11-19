import { compareRoleRank } from '@/features/auth/permissions';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { RoleForm, DeleteRoleForm } from '@/components/admin/staff-forms';

export const metadata = { title: 'Roles & Permissions' };

const permissionLabels: Record<string, string> = {
  'people.read': 'People Access',
  'roles.read': 'Role Access',
  'staff.manage': 'Role Assignment',
  'roles.manage': 'Manage Roles',
};

export default async function RolesPage() {
  const access = await requireStaff('roles.read');
  const canManage = access.permissions.includes('roles.manage');
  const canGrant = (key: string) =>
    (access.can_manage_all_staff_roles ?? access.is_owner) ||
    (!['roles.manage', 'staff.manage'].includes(key) && access.permissions.includes(key));
  const client = await createClient();
  const [roles, permissions, grants] = await Promise.all([
    client
      .from('roles')
      .select('id,name,slug,is_system,is_active')
      .eq('restaurant_id', access.restaurant_id)
      .order('name'),
    client.from('permissions').select('key,description').order('key'),
    client
      .from('role_permissions')
      .select('role_id,permission_key')
      .eq('restaurant_id', access.restaurant_id),
  ]);
  if (roles.error || permissions.error || grants.error)
    throw new Error('Unable to load roles and permissions.');
  const grantable = permissions.data.filter(({ key }) => canGrant(key));
  const orderedRoles = [...roles.data].sort(compareRoleRank);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Roles &amp; Permissions</h1>
      <p className="text-sm text-muted-foreground">
        Choose a role to see its allowed actions. Staff with Manage Roles access can edit custom
        roles within their permissions.
      </p>
      {canManage && (
        <details className="rounded-xl border bg-card p-5">
          <summary className="cursor-pointer font-semibold">Create a custom role</summary>
          <RoleForm permissions={grantable} />
        </details>
      )}
      <div className="space-y-3">
        {orderedRoles.map((role) => {
          const selected =
            role.slug === 'owner'
              ? permissions.data.map((action) => action.key)
              : grants.data
                  .filter((grant) => grant.role_id === role.id)
                  .map((grant) => grant.permission_key);
          const allowed = permissions.data.filter((action) => selected.includes(action.key));
          return (
            <details key={role.id} className="rounded-xl border bg-card p-5">
              <summary className="cursor-pointer font-medium">
                {role.name}{' '}
                <span className="ml-2 text-xs text-muted-foreground">
                  {role.is_system ? 'Built-in' : 'Custom'} · {allowed.length} allowed actions
                  {!role.is_active ? ' · Inactive' : ''}
                </span>
              </summary>
              {canManage && !role.is_system && selected.every(canGrant) ? (
                <>
                  <RoleForm
                    key={selected.join(',')}
                    role={role}
                    permissions={grantable}
                    selected={selected}
                  />
                  <DeleteRoleForm id={role.id} />
                </>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {!allowed.length && (
                    <li className="text-sm text-muted-foreground">No staff permissions.</li>
                  )}
                  {allowed.map((action) => (
                    <li key={action.key} className="rounded-lg border p-3 text-sm">
                      {permissionLabels[action.key] && (
                        <p className="mb-1 font-medium">{permissionLabels[action.key]}</p>
                      )}
                      <code className="text-xs font-semibold">{action.key}</code>
                      <p className="mt-1 text-muted-foreground">{action.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}
