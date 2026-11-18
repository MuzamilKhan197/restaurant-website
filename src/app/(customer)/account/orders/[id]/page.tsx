import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/features/auth/session';
import { getRestaurantId } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/features/menu/utils';
import { OrderRefresh } from '@/components/admin/order-refresh';
export const metadata = { title: 'Order details' };
export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser('/account/orders/' + id),
    tenant = getRestaurantId(),
    client = await createClient();
  if (!tenant) notFound();
  const customer = await client
    .from('restaurant_customers')
    .select('id')
    .eq('restaurant_id', tenant)
    .eq('user_id', user.id)
    .maybeSingle();
  if (customer.error) throw new Error('Unable to load your profile.');
  if (!customer.data) notFound();
  const result = await client
    .from('orders')
    .select(
      'id,reference,status,method,payment_method,currency,subtotal_minor,delivery_fee_minor,tax_minor,total_minor,created_at,rejection_reason,cancellation_reason',
    )
    .eq('restaurant_id', tenant)
    .eq('customer_id', customer.data.id)
    .eq('id', id)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load your order.');
  if (!result.data) notFound();
  const order = result.data;
  const [items, addons, events, payment] = await Promise.all([
    client
      .from('order_items')
      .select('id,product_name,variant_name,quantity,unit_price_minor,line_total_minor,allergens')
      .eq('restaurant_id', tenant)
      .eq('order_id', id)
      .order('created_at'),
    client
      .from('order_item_addons')
      .select('order_item_id,addon_name,quantity,unit_price_minor')
      .eq('restaurant_id', tenant)
      .eq('order_id', id),
    client
      .from('order_status_events')
      .select('id,status,created_at')
      .eq('restaurant_id', tenant)
      .eq('order_id', id)
      .order('created_at'),
    client
      .from('payments')
      .select('status')
      .eq('restaurant_id', tenant)
      .eq('order_id', id)
      .maybeSingle(),
  ]);
  if ([items, addons, events, payment].some((r) => r.error))
    throw new Error('Unable to load order details.');
  const price = (minor: number) => formatPrice(minor / 100, order.currency);
  return (
    <section className="site-container max-w-4xl py-14">
      <Link href="/account/orders" className="text-sm underline">
        All orders
      </Link>
      <h1 className="mt-6 break-all font-serif text-3xl">{order.reference}</h1>
      <div className="mt-4">
        <OrderRefresh restaurantId={tenant} />
      </div>
      <p className="mt-4 capitalize">
        {order.status} · {order.method}
      </p>
      {(order.rejection_reason || order.cancellation_reason) && (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm">
          {order.rejection_reason || order.cancellation_reason}
        </p>
      )}
      <div className="mt-8 space-y-4">
        {items.data?.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-5">
            <div className="flex justify-between gap-4">
              <h2 className="font-semibold">
                {item.quantity} × {item.product_name}
                {item.variant_name ? ' · ' + item.variant_name : ''}
              </h2>
              <span>{price(item.line_total_minor)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Unit price: {price(item.unit_price_minor)}
            </p>
            {addons.data
              ?.filter((a) => a.order_item_id === item.id)
              .map((a, index) => (
                <p key={index} className="mt-2 text-sm">
                  {a.quantity} × {a.addon_name} (+{price(a.unit_price_minor)} each per dish)
                </p>
              ))}
            {item.allergens.length > 0 && (
              <p className="mt-3 text-xs">
                Allergens at time of order: {item.allergens.join(', ')}
              </p>
            )}
          </article>
        ))}
      </div>
      <dl className="mt-8 space-y-3 rounded-xl border p-6">
        {[
          ['Subtotal', order.subtotal_minor],
          ['Delivery', order.delivery_fee_minor],
          ['Tax', order.tax_minor],
          ['Total', order.total_minor],
        ].map(([label, amount]) => (
          <div key={label} className="flex justify-between">
            <dt>{label}</dt>
            <dd>{price(Number(amount))}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm capitalize">
        {order.payment_method.replaceAll('_', ' ')} ·{' '}
        {payment.data?.status || 'Payment status unavailable'}
      </p>
      <Link
        href={'/support/new?order=' + order.reference}
        className="mt-6 inline-block text-sm underline"
      >
        Get help with this order
      </Link>
      <h2 className="mt-8 font-semibold">Order updates</h2>
      <ol className="mt-4 space-y-3">
        {events.data?.length ? (
          events.data.map((event) => (
            <li key={event.id} className="border-l-2 pl-4 text-sm">
              <span className="capitalize">{event.status}</span>
              <time dateTime={event.created_at} className="ml-3 text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
              </time>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">No additional updates yet.</li>
        )}
      </ol>
    </section>
  );
}
