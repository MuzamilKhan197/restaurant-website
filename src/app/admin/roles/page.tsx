import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { RoleForm, DeleteRoleForm } from '@/components/admin/staff-forms';

export const metadata = { title: 'Roles & Permissions' };

export default async function RolesPage() {
  const access = await requireStaff('roles.read');
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

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Roles &amp; Permissions</h1>
      <p className="text-sm text-muted-foreground">
        Choose a role to see its allowed actions. Owners can create and edit custom roles.
      </p>
      {access.is_owner && (
        <details className="rounded-xl border bg-card p-5">
          <summary className="cursor-pointer font-semibold">Create a custom role</summary>
          <RoleForm permissions={permissions.data} />
        </details>
      )}
      <div className="space-y-3">
        {roles.data.map((role) => {
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
              {access.is_owner && !role.is_system ? (
                <>
                  <RoleForm
                    key={selected.join(',')}
                    role={role}
                    permissions={permissions.data}
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
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">All available actions</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {permissions.data.map((action) => (
            <div key={action.key} className="rounded-lg border p-3 text-sm">
              <dt className="font-semibold">
                {action.key === 'people.read'
                  ? 'People Access'
                  : action.key === 'roles.read'
                    ? 'Roles Access'
                    : action.key === 'staff.manage'
                      ? 'Role Assignment'
                      : action.key === 'roles.manage'
                        ? 'Manage Roles'
                        : action.description}
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground">
                <code>{action.key}</code>
              </dd>
              {['people.read', 'roles.read', 'staff.manage', 'roles.manage'].includes(
                action.key,
              ) && <dd className="mt-2 text-xs text-muted-foreground">{action.description}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
