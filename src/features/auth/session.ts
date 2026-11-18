import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { getRestaurantId } from './config';
import { safeNext, staffAccessSchema } from './validation';

// React cache deduplicates only within the server render, never across users.
export const getVerifiedUser = cache(async () => {
  if (!getSupabaseConfig()) return null;
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return !error && user && !user.is_anonymous && user.email_confirmed_at ? user : null;
});

export async function requireUser(next = '/account') {
  const user = await getVerifiedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return user;
}
export const getStaffAccess = cache(async () => {
  const user = await getVerifiedUser();
  const restaurantId = getRestaurantId();
  if (!user || !restaurantId) return null;
  const client = await createClient();
  const { data, error } = await client.rpc('current_staff_access', { p_restaurant: restaurantId });
  const parsed = staffAccessSchema.safeParse(data);
  return !error && parsed.success ? parsed.data : null;
});
export async function requireStaff(permission?: string) {
  await requireUser('/admin');
  if (!getRestaurantId()) redirect('/setup');
  const access = await getStaffAccess();
  if (!access || (permission && !access.permissions.includes(permission)))
    redirect('/access-denied');
  return access;
}
