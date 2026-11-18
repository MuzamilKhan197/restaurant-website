'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createInvitation,
  revokeInvitation,
  updateMember,
  saveRole,
  deleteRole,
} from '@/features/auth/staff-actions';
import type { AuthState } from '@/features/auth/types';

export type RoleChoice = { id: string; name: string; slug: string };
const selectClass =
  'h-10 w-full rounded-md border bg-background px-3 text-xs focus:outline-2 focus:outline-ring';
function Feedback({ state }: { state: AuthState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="mt-3 text-xs leading-6 text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-3 text-xs leading-6 text-emerald-700">
          {state.success}
        </p>
      )}
    </>
  );
}
export function InvitationForm({ roles }: { roles: RoleChoice[] }) {
  const [state, action, pending] = useActionState(createInvitation, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-email" className="mb-2 block text-xs">
            Employee email
          </label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="teammate@example.com"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="mb-2 block text-xs">
            Role
          </label>
          <select id="invite-role" name="role" required className={selectClass}>
            <option value="">Choose a role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button size="sm" disabled={pending || !roles.length}>
        {pending ? 'Creating…' : 'Create invitation link'}
      </Button>
      <Feedback state={state} />
      {state.invitationUrl && (
        <div className="rounded-xl border bg-secondary/40 p-4">
          <label htmlFor="invitation-link" className="mb-2 block text-xs font-medium">
            Private invitation link — copy it now
          </label>
          <Input
            id="invitation-link"
            value={state.invitationUrl}
            readOnly
            onFocus={(event) => event.target.select()}
          />
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            Only the token hash is stored. This link cannot be recovered after leaving the page.
          </p>
        </div>
      )}
    </form>
  );
}
export function MemberForm({
  member,
  roles,
}: {
  member: { id: string; role_id: string; status: string };
  roles: RoleChoice[];
}) {
  const [state, action, pending] = useActionState(updateMember, {});
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="member" value={member.id} />
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Staff role"
          name="role"
          defaultValue={member.role_id}
          className={selectClass + ' sm:w-48'}
          required
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Staff access status"
          name="status"
          defaultValue={member.status}
          className={selectClass + ' sm:w-36'}
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <Button size="sm" variant="outline" disabled={pending}>
          {pending ? 'Saving…' : 'Save access'}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
export function RevokeForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeInvitation, {});
  return (
    <form action={action}>
      <input type="hidden" name="invitation" value={id} />
      <Button size="sm" variant="outline" disabled={pending}>
        Revoke invitation
      </Button>
      <Feedback state={state} />
    </form>
  );
}
export function RoleForm({
  role,
  permissions,
  selected = [],
}: {
  role?: RoleChoice;
  permissions: { key: string; description: string }[];
  selected?: string[];
}) {
  const [state, action, pending] = useActionState(saveRole, {});
  const prefix = role?.id || 'new';
  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={role?.id || ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-name`} className="mb-2 block text-xs">
            Role name
          </label>
          <Input
            id={`${prefix}-name`}
            name="name"
            defaultValue={role?.name}
            required
            maxLength={80}
            placeholder="Kitchen lead"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-slug`} className="mb-2 block text-xs">
            Unique slug
          </label>
          <Input
            id={`${prefix}-slug`}
            name="slug"
            defaultValue={role?.slug}
            readOnly={Boolean(role)}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            maxLength={80}
            placeholder="kitchen-lead"
          />
        </div>
      </div>
      <fieldset>
        <legend className="mb-3 text-xs font-medium">Allowed actions</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {permissions
            .filter((p) => !['staff.manage', 'roles.manage'].includes(p.key))
            .map((p) => (
              <label key={p.key} className="flex items-start gap-2 text-[11px] leading-5">
                <input
                  type="checkbox"
                  name="permissions"
                  value={p.key}
                  defaultChecked={selected.includes(p.key)}
                  className="mt-1 accent-blue-600"
                />
                <span>
                  <span className="block font-medium">{p.key}</span>
                  <span className="text-muted-foreground">{p.description}</span>
                </span>
              </label>
            ))}
        </div>
      </fieldset>
      <Button size="sm" disabled={pending}>
        {pending ? 'Saving…' : role ? 'Save permissions' : 'Create custom role'}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
export function DeleteRoleForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteRole, {});
  return (
    <form action={action} className="mt-4 border-t pt-4">
      <input type="hidden" name="id" value={id} />
      <Button size="sm" variant="outline" disabled={pending}>
        Delete unused custom role
      </Button>
      <Feedback state={state} />
    </form>
  );
}
