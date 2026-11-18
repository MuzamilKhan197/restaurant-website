'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/features/auth/session';
import { getRestaurantId } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { profileSchema, addressSchema, type CustomerState } from './validation';
function finish(error: unknown, message: string): CustomerState {
  if (error) return { error: 'Unable to save. Check your details and try again.' };
  revalidatePath('/account', 'layout');
  return { success: message };
}
export async function saveProfile(_: CustomerState, form: FormData): Promise<CustomerState> {
  await requireUser();
  const tenant = getRestaurantId();
  if (!tenant) return { error: 'Restaurant unavailable.' };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const client = await createClient();
  const result = await client.rpc('save_customer_profile', {
    p_restaurant: tenant,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
  });
  return finish(result.error, 'Profile saved.');
}
export async function saveAddress(_: CustomerState, form: FormData): Promise<CustomerState> {
  await requireUser('/account/addresses');
  const tenant = getRestaurantId();
  if (!tenant) return { error: 'Restaurant unavailable.' };
  const parsed = addressSchema.safeParse({
    ...Object.fromEntries(form),
    is_default: form.get('is_default') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data,
    client = await createClient();
  const result = await client.rpc('save_customer_address', {
    p_restaurant: tenant,
    p_address: d.id || null,
    p_label: d.label,
    p_line: d.address_line,
    p_area: d.area,
    p_city: d.city,
    p_instructions: d.instructions,
    p_default: d.is_default,
  });
  return finish(result.error, 'Address saved.');
}
export async function deleteAddress(_: CustomerState, form: FormData): Promise<CustomerState> {
  const user = await requireUser('/account/addresses'),
    tenant = getRestaurantId(),
    id = z.uuid().safeParse(form.get('id'));
  if (!tenant || !id.success) return { error: 'Address unavailable.' };
  const client = await createClient();
  const customer = await client
    .from('restaurant_customers')
    .select('id')
    .eq('restaurant_id', tenant)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!customer.data || customer.error) return { error: 'Address unavailable.' };
  const result = await client
    .from('customer_addresses')
    .delete()
    .eq('restaurant_id', tenant)
    .eq('customer_id', customer.data.id)
    .eq('id', id.data)
    .select('id')
    .single();
  return finish(result.error, 'Address removed.');
}
