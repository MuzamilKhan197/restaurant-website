'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { CustomerState } from '@/features/customers/validation';
export async function setCatalogPublication(
  _: CustomerState,
  form: FormData,
): Promise<CustomerState> {
  const access = await requireStaff();
  if (!access.is_owner) return { error: 'Only the owner can publish the restaurant.' };
  const published = form.get('published');
  if (!['true', 'false'].includes(String(published)))
    return { error: 'Invalid publication setting.' };
  const client = await createClient();
  const result = await client
    .from('restaurants')
    .update({ is_published: published === 'true' })
    .eq('id', access.restaurant_id)
    .select('id')
    .single();
  if (result.error) return { error: 'Unable to update publication. Please try again.' };
  revalidatePath('/', 'layout');
  return {
    success:
      published === 'true'
        ? 'Restaurant published. Ordering availability is controlled separately.'
        : 'Restaurant unpublished.',
  };
}
