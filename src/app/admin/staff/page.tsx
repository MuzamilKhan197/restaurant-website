import { compareRoleRank } from '@/features/auth/permissions';
import { invitationStatus } from '@/features/auth/invitation-status';
import { requireStaff, requireUser } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InvitationForm, MemberForm, RevokeForm } from '@/components/admin/staff-forms';
export const metadata = { title: 'Role Assignment' };
export const dynamic = 'force-dynamic';
export default async function StaffPage() {
  const access = await requireStaff('staff.read');
  const user = await requireUser('/admin/staff');
  const canManage = access.permissions.includes('staff.manage');
  const client = await createClient();
  const [members, roles, invitations, assignments, grants] = await Promise.all([
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
    canManage
      ? client
          .from('staff_invitations')
          .select('id,email,role_id,expires_at,accepted_at,revoked_at')
          .eq('restaurant_id', access.restaurant_id)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    client
      .from('staff_additional_roles')
      .select('membership_id,role_id')
      .eq('restaurant_id', access.restaurant_id),
    client
      .from('role_permissions')
      .select('role_id,permission_key')
      .eq('restaurant_id', access.restaurant_id),
  ]);
  if ([members, roles, invitations, assignments, grants].some((result) => result.error))
    throw new Error('Unable to load team access. Please retry.');
  const canAssign = (roleId: string) =>
    (access.can_manage_all_staff_roles ?? access.is_owner) ||
    (grants.data || []).every(
      (grant) =>
        grant.role_id !== roleId ||
        (!['roles.manage', 'staff.manage'].includes(grant.permission_key) &&
          access.permissions.includes(grant.permission_key)),
    );
  const staffRoles = (roles.data || [])
    .filter(
      (role) => role.is_active && !['owner', 'customer'].includes(role.slug) && canAssign(role.id),
    )
    .sort(compareRoleRank);
  return (
    <>
      <p className="eyebrow text-[9px]">The people behind the experience</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Role Assignment</h1>
      <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground">
        Staff with Role Assignment access can invite teammates and assign roles within their
        permissions.
      </p>
      {canManage && (
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
          {members.data?.map((member) => {
            const extraRoles = (assignments.data || [])
              .filter((a) => a.membership_id === member.id)
              .map((a) => a.role_id);
            return (
              <div key={member.id} id={member.id} className="scroll-mt-20 py-5 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{member.display_name || 'Team member'}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {member.contact_email || 'No contact email'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {roles.data?.find((r) => r.id === member.role_id)?.name || 'Role unavailable'}
                    </Badge>
                    {extraRoles.map((id) => (
                      <Badge key={id} variant="outline">
                        {roles.data?.find((role) => role.id === id)?.name || 'Role unavailable'}
                      </Badge>
                    ))}
                    <Badge variant="outline">{member.status}</Badge>
                  </div>
                </div>
                {canManage &&
                  member.user_id !== user.id &&
                  [member.role_id, ...extraRoles].every(canAssign) &&
                  roles.data?.find((r) => r.id === member.role_id)?.slug !== 'owner' && (
                    <MemberForm
                      key={JSON.stringify([member.role_id, member.status, extraRoles.sort()])}
                      member={member}
                      roles={staffRoles}
                      extraRoles={extraRoles}
                    />
                  )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      {canManage && (
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
                    {invitationStatus(invite)} � Expires{' '}
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
    </>
  );
}
