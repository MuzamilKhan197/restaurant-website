import Link from 'next/link';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/features/menu/utils';
import { OrderForm } from '@/components/admin/order-form';
import { OrderRefresh } from '@/components/admin/order-refresh';
export const metadata = { title: 'Order details' };
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireStaff('orders.read'),
    client = await createClient(),
    id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await client
    .from('orders')
    .select('*')
    .eq('restaurant_id', access.restaurant_id)
    .eq('id', id)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load order.');
  if (!result.data) notFound();
  const order = result.data;
  const [items, addons, payment, events] = await Promise.all([
    client
      .from('order_items')
      .select('*')
      .eq('restaurant_id', access.restaurant_id)
      .eq('order_id', id)
      .order('created_at'),
    client
      .from('order_item_addons')
      .select('order_item_id,addon_name,quantity,unit_price_minor')
      .eq('restaurant_id', access.restaurant_id)
      .eq('order_id', id),
    client
      .from('payments')
      .select('status,method,amount_minor')
      .eq('restaurant_id', access.restaurant_id)
      .eq('order_id', id)
      .maybeSingle(),
    client
      .from('order_status_events')
      .select('id,status,created_at')
      .eq('restaurant_id', access.restaurant_id)
      .eq('order_id', id)
      .order('created_at'),
  ]);
  if ([items, addons, payment, events].some((r) => r.error))
    throw new Error('Unable to load order details.');
  const price = (amount: number) => formatPrice(amount / 100, order.currency),
    address = z
      .object({
        address_line: z.string(),
        area: z.string(),
        city: z.string(),
        instructions: z.string().optional(),
      })
      .safeParse(order.delivery_address);
  return (
    <>
      <Link className="text-sm underline" href="/admin/orders">
        All orders
      </Link>
      <h1 className="mt-5 break-all text-3xl font-semibold">{order.reference}</h1>
      <p className="mt-3 capitalize">
        {order.status} · {order.method}
      </p>
      <div className="mt-3">
        <OrderRefresh restaurantId={access.restaurant_id} />
      </div>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <article className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Customer and fulfilment</h2>
            <p className="text-sm">{order.contact_name}</p>
            <p className="break-all text-sm">{order.contact_email}</p>
            <p className="text-sm">{order.contact_phone}</p>
            {address.success && (
              <p className="text-sm">
                {address.data.address_line}, {address.data.area}, {address.data.city}
                <br />
                {address.data.instructions}
              </p>
            )}
            {order.notes && (
              <p className="whitespace-pre-wrap text-sm">Order notes: {order.notes}</p>
            )}
            {(order.rejection_reason || order.cancellation_reason) && (
              <p className="text-sm">{order.rejection_reason || order.cancellation_reason}</p>
            )}
          </article>
          {items.data?.map((item) => (
            <article key={item.id} className="rounded-xl border bg-card p-5">
              <div className="flex justify-between gap-4">
                <h2 className="font-semibold">
                  {item.quantity} × {item.product_name}
                  {item.variant_name ? ' · ' + item.variant_name : ''}
                </h2>
                <p>{price(item.line_total_minor)}</p>
              </div>
              {addons.data
                ?.filter((a) => a.order_item_id === item.id)
                .map((a, i) => (
                  <p key={i} className="mt-2 text-sm">
                    {a.quantity} × {a.addon_name} (+{price(a.unit_price_minor)} each per dish)
                  </p>
                ))}
              {item.allergens.length > 0 && (
                <p className="mt-3 text-xs text-red-700">Allergens: {item.allergens.join(', ')}</p>
              )}
            </article>
          ))}
          <dl className="space-y-3 rounded-xl border bg-card p-5">
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
          <ol className="space-y-3">
            {events.data?.map((e) => (
              <li key={e.id} className="border-l-2 pl-4 text-sm">
                <span className="capitalize">{e.status}</span> ·{' '}
                {new Date(e.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
              </li>
            ))}
          </ol>
        </div>
        <aside className="space-y-5">
          {access.permissions.includes('orders.update') && (
            <OrderForm key={order.status} id={id} status={order.status} />
          )}
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm capitalize">
              Cash payment: {payment.data?.status.replaceAll('_', ' ') || 'unavailable'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Confirm money actually received or refunded before recording payment.
            </p>
          </div>
          {payment.data && access.permissions.includes('payments.manage') && (
            <OrderForm
              key={payment.data.status + order.status}
              id={id}
              status={payment.data.status}
              orderStatus={order.status}
              payment
            />
          )}
        </aside>
      </div>
    </>
  );
}
