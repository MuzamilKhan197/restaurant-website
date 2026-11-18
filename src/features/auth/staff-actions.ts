'use server';
import { randomBytes, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireStaff, requireUser } from './session';
import { invitationSchema, memberSchema, roleSchema, tokenSchema } from './validation';
import { getAppUrl } from './config';
import type { AuthState } from './types';

export async function createInvitation(_state: AuthState, form: FormData): Promise<AuthState> {
  const access = await requireStaff('staff.manage');
  const parsed = invitationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter a valid email and choose a staff role.' };
  const origin = getAppUrl();
  const token = randomBytes(32).toString('hex');
  const client = await createClient();
  const { error } = await client.rpc('create_staff_invitation', {
    p_restaurant: access.restaurant_id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: createHash('sha256').update(token).digest('hex'),
  });
  if (error)
    return {
      error:
        'Unable to create this invitation. Check the role, existing team membership and invitation limit.',
    };
  revalidatePath('/admin/staff');
  return {
    success:
      'Invitation created. Share this private link directly with the intended recipient. It expires in 48 hours.',
    invitationUrl: `${origin}/invite#token=${token}`,
  };
}
export async function revokeInvitation(_state: AuthState, form: FormData): Promise<AuthState> {
  const access = await requireStaff('staff.manage');
  const id = z.uuid().safeParse(form.get('invitation'));
  if (!id.success) return { error: 'Invalid invitation.' };
  const client = await createClient();
  const { error } = await client.rpc('revoke_staff_invitation', {
    p_restaurant: access.restaurant_id,
    p_invitation: id.data,
  });
  if (error) return { error: 'This invitation is no longer available.' };
  revalidatePath('/admin/staff');
  return { success: 'Invitation revoked.' };
}
export async function updateMember(_state: AuthState, form: FormData): Promise<AuthState> {
  const access = await requireStaff('staff.manage');
  const parsed = memberSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Choose a valid role and account status.' };
  const client = await createClient();
  const { error } = await client.rpc('manage_staff_member', {
    p_restaurant: access.restaurant_id,
    p_member: parsed.data.member,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
  });
  if (error)
    return { error: 'Unable to update this team member. Owner access cannot be reassigned here.' };
  revalidatePath('/admin', 'layout');
  return { success: 'Team access updated.' };
}
export async function saveRole(_state: AuthState, form: FormData): Promise<AuthState> {
  const access = await requireStaff('roles.manage');
  const parsed = roleSchema.safeParse({
    ...Object.fromEntries(form),
    permissions: form.getAll('permissions'),
  });
  if (!parsed.success) return { error: 'Check the role name, slug and permissions.' };
  const client = await createClient();
  const { error } = await client.rpc('save_custom_role', {
    p_restaurant: access.restaurant_id,
    p_role: parsed.data.id || null,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_permissions: parsed.data.permissions,
  });
  if (error)
    return {
      error:
        'Unable to save this role. Use a unique slug and valid permissions. Built-in roles are protected.',
    };
  revalidatePath('/admin', 'layout');
  return { success: 'Custom role saved.' };
}
export async function deleteRole(_state: AuthState, form: FormData): Promise<AuthState> {
  const access = await requireStaff('roles.manage');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Invalid role.' };
  const client = await createClient();
  const { error, data } = await client
    .from('roles')
    .delete()
    .eq('restaurant_id', access.restaurant_id)
    .eq('id', id.data)
    .eq('is_system', false)
    .select('id');
  if (error || data?.length !== 1)
    return {
      error: 'Role could not be deleted. Reassign members and revoke its invitations first.',
    };
  revalidatePath('/admin/staff');
  return { success: 'Custom role deleted.' };
}
export async function acceptInvitation(_state: AuthState, form: FormData): Promise<AuthState> {
  await requireUser('/invite');
  const token = tokenSchema.safeParse(form.get('token'));
  if (!token.success)
    return { error: 'Open the complete invitation link shared by the restaurant owner.' };
  const client = await createClient();
  const { error } = await client.rpc('accept_staff_invitation', { p_token: token.data });
  if (error)
    return {
      error:
        'Invitation unavailable. It may have expired, been revoked or belong to a different email address.',
    };
  revalidatePath('/admin', 'layout');
  redirect('/admin');
}
