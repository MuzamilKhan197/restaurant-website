import { invitationStatus } from '@/features/auth/invitation-status';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  InvitationForm,
  MemberForm,
  RevokeForm,
  RoleForm,
  DeleteRoleForm,
} from '@/components/admin/staff-forms';
export const metadata = { title: 'Staff & permissions' };
export const dynamic = 'force-dynamic';
export default async function StaffPage() {
  const access = await requireStaff('staff.read');
  const client = await createClient();
  const [members, roles, permissions, grants, invitations] = await Promise.all([
    client
      .from('staff_memberships')
      .select('id,user_id,display_name,contact_email,role_id,status')
      .eq('restaurant_id', access.restaurant_id)
      .order('created_at'),
    client
      .from('roles')
      .select('id,name,slug,is_system,is_active')
      .eq('restaurant_id', access.restaurant_id)
      .order('created_at'),
    client.from('permissions').select('key,description').order('key'),
    client
      .from('role_permissions')
      .select('role_id,permission_key')
      .eq('restaurant_id', access.restaurant_id),
    access.is_owner
      ? client
          .from('staff_invitations')
          .select('id,email,role_id,expires_at,accepted_at,revoked_at')
          .eq('restaurant_id', access.restaurant_id)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if ([members, roles, permissions, grants, invitations].some((result) => result.error))
    throw new Error('Unable to load team access. Please retry.');
  const staffRoles = (roles.data || []).filter(
    (role) => role.is_active && !['owner', 'customer'].includes(role.slug),
  );
  return (
    <>
      <p className="eyebrow text-[9px]">The people behind the experience</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your team. The right access.</h1>
      <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground">
        Active roles control access in the backend and database. Only the restaurant owner can
        invite staff or change permissions.
      </p>
      {access.is_owner && (
        <Card className="mt-7">
          <CardHeader>
            <CardTitle className="text-sm">Invite a teammate</CardTitle>
            <CardDescription className="text-xs leading-6">
              Create a private, email-bound link. The employee signs in with a verified account,
              then accepts it. No email is sent automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvitationForm roles={staffRoles} />
          </CardContent>
        </Card>
      )}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Team members</CardTitle>
          <CardDescription className="text-xs">
            Suspending access takes effect on the next request.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {!members.data?.length && (
            <p className="py-8 text-xs text-muted-foreground">
              No staff memberships yet. The verified owner can be bootstrapped by the project
              operator.
            </p>
          )}
          {members.data?.map((member) => (
            <div key={member.id} className="py-5 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{member.display_name || 'Team member'}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {member.contact_email || 'No contact email'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {roles.data?.find((r) => r.id === member.role_id)?.name || 'Role unavailable'}
                  </Badge>
                  <Badge variant="outline">{member.status}</Badge>
                </div>
              </div>
              {access.is_owner &&
                roles.data?.find((r) => r.id === member.role_id)?.slug !== 'owner' && (
                  <MemberForm member={member} roles={staffRoles} />
                )}
            </div>
          ))}
        </CardContent>
      </Card>
      {access.is_owner && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Recent invitations</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {!invitations.data?.length && (
              <p className="text-xs text-muted-foreground">No invitations created yet.</p>
            )}
            {invitations.data?.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="break-all text-xs font-medium">{invite.email}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {invitationStatus(invite)} · Expires{' '}
                    {new Date(invite.expires_at).toLocaleString('en-PK', {
                      timeZone: 'Asia/Karachi',
                    })}
                  </p>
                </div>
                {invitationStatus(invite) === 'Pending' && <RevokeForm id={invite.id} />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Roles &amp; permissions</CardTitle>
          <CardDescription className="text-xs leading-6">
            Built-in role identities are protected. Custom roles can grant operational access; staff
            and role management remain owner-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {roles.data?.map((role) => (
            <details key={role.id} className="rounded-xl border p-4">
              <summary className="cursor-pointer text-xs font-medium">
                {role.name}{' '}
                <span className="ml-2 font-normal text-muted-foreground">
                  {role.is_system ? 'Built-in' : 'Custom'}
                </span>
              </summary>
              {access.is_owner && !role.is_system ? (
                <>
                  <RoleForm
                    role={role}
                    permissions={permissions.data || []}
                    selected={grants.data
                      ?.filter((g) => g.role_id === role.id)
                      .map((g) => g.permission_key)}
                  />
                  <DeleteRoleForm id={role.id} />
                </>
              ) : (
                <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
                  {role.slug === 'owner'
                    ? 'All restaurant permissions; verified ownership required.'
                    : grants.data
                        ?.filter((g) => g.role_id === role.id)
                        .map((g) => g.permission_key)
                        .join(', ') || 'No staff permissions.'}
                </p>
              )}
            </details>
          ))}
          {access.is_owner && (
            <details className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
              <summary className="cursor-pointer text-xs font-medium text-blue-800">
                Create a custom role
              </summary>
              <RoleForm permissions={permissions.data || []} />
            </details>
          )}
        </CardContent>
      </Card>
    </>
  );
}
