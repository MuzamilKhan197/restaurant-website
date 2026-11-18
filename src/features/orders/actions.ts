'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getRestaurantId } from '@/features/auth/config';
import { requireStaff, getVerifiedUser } from '@/features/auth/session';
import {
  cartSchema,
  checkoutSchema,
  quoteSchema,
  type Quote,
  type CheckoutState,
  cashUpdateSchema,
} from './validation';
function cartInput(raw: unknown) {
  try {
    return cartSchema.safeParse(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    return cartSchema.safeParse(null);
  }
}
function message(error: { code?: string; message?: string } | null) {
  return error?.code === '22023'
    ? error.message || 'Check your cart details.'
    : 'Unable to complete the request. Please try again.';
}
export async function quoteCheckout(
  items: unknown,
  method: string,
  zone: string,
): Promise<{ quote?: Quote; error?: string }> {
  const cart = cartInput(items),
    tenant = getRestaurantId();
  if (
    !cart.success ||
    !tenant ||
    !['pickup', 'delivery'].includes(method) ||
    (zone && !z.uuid().safeParse(zone).success)
  )
    return { error: 'Check your cart and delivery details.' };
  const client = await createClient();
  const result = await client.rpc('quote_cart', {
    p_restaurant: tenant,
    p_items: cart.data,
    p_method: method,
    p_zone: method === 'delivery' ? zone || null : null,
  });
  const parsed = quoteSchema.safeParse(result.data);
  return result.error
    ? { error: message(result.error) }
    : parsed.success
      ? { quote: parsed.data }
      : { error: 'Unable to calculate your total.' };
}
export async function placeCheckout(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const cart = cartInput(form.get('items')),
    checkout = checkoutSchema.safeParse(Object.fromEntries(form)),
    token = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .safeParse(form.get('token')),
    expected = z.coerce.number().int().nonnegative().safeParse(form.get('expected_total')),
    tenant = getRestaurantId();
  if (!tenant || !cart.success || !token.success || !expected.success)
    return { error: 'Review your cart and request a fresh total.' };
  if (!checkout.success) return { error: checkout.error.issues[0].message };
  const client = await createClient();
  const result = await client.rpc('place_customer_order', {
    p_restaurant: tenant,
    p_items: cart.data,
    p_checkout: checkout.data,
    p_token: token.data,
    p_expected_total: expected.data,
  });
  if (result.error) return { error: message(result.error) };
  const parsed = z
    .object({ id: z.uuid(), reference: z.string().regex(/^ORD-[A-F0-9]+$/) })
    .safeParse(result.data);
  if (!parsed.success)
    return {
      error: 'Order response unavailable. Retry with the same checkout to avoid duplicates.',
    };
  revalidatePath('/admin/orders');
  revalidatePath('/account/orders');
  return {
    reference: parsed.data.reference,
    token: token.data,
    ...((await getVerifiedUser()) ? { accountOrderId: parsed.data.id } : {}),
  };
}
export async function getTrackedOrder(reference: string, token: string) {
  if (!/^ORD-[A-Z0-9-]{1,40}$/.test(reference) || !/^[a-f0-9]{64}$/.test(token))
    return { error: 'This private tracking link is invalid.' };
  const tenant = getRestaurantId();
  if (!tenant) return { error: 'Restaurant unavailable.' };
  const client = await createClient();
  const result = await client.rpc('read_order_capability', {
    p_restaurant: tenant,
    p_reference: reference,
    p_token: token,
  });
  if (result.error) return { error: 'Unable to refresh your order. Please retry.' };
  return result.data
    ? { order: result.data }
    : { error: 'Order unavailable. The link may have expired or been revoked.' };
}
export async function updateOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const access = await requireStaff('orders.update'),
    data = z
      .object({
        id: z.uuid(),
        status: z.enum(['accepted', 'preparing', 'ready', 'completed', 'rejected', 'cancelled']),
        reason: z.string().trim().max(500),
        previous: z.enum([
          'pending',
          'accepted',
          'preparing',
          'ready',
          'completed',
          'rejected',
          'cancelled',
        ]),
      })
      .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: 'Check the order details.' };
  const d = data.data;
  if (['rejected', 'cancelled'].includes(d.status) && !d.reason)
    return { error: 'Enter a reason.' };
  const client = await createClient();
  const result = await client
    .from('orders')
    .update({
      status: d.status,
      ...(d.status === 'rejected' ? { rejection_reason: d.reason } : {}),
      ...(d.status === 'cancelled' ? { cancellation_reason: d.reason } : {}),
    })
    .eq('restaurant_id', access.restaurant_id)
    .eq('id', d.id)
    .eq('status', d.previous)
    .select('id')
    .single();
  if (result.error)
    return { error: 'Order changed or this transition is unavailable. Refresh and retry.' };
  revalidatePath('/admin/orders', 'layout');
  revalidatePath('/admin/reports');
  revalidatePath('/admin');
  revalidatePath('/account/orders', 'layout');
  return { success: 'Order updated.' };
}
export async function recordCash(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const access = await requireStaff('payments.manage'),
    parsed = cashUpdateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: 'Payment changed or this transition is unavailable. Refresh and retry.' };
  const data = parsed.data;
  const client = await createClient();
  const result = await client
    .from('payments')
    .update({ status: data.status })
    .eq('restaurant_id', access.restaurant_id)
    .eq('order_id', data.id)
    .eq('status', data.previous)
    .select('id')
    .single();
  if (result.error)
    return { error: 'Unable to update cash status. Check the order and current payment.' };
  revalidatePath('/admin/orders', 'layout');
  revalidatePath('/admin/reports');
  revalidatePath('/admin');
  revalidatePath('/account/orders', 'layout');
  return { success: 'Cash status recorded.' };
}
