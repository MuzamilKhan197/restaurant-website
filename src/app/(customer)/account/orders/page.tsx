import Link from 'next/link';
import { requireUser } from '@/features/auth/session';
import { getRestaurantId } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/features/menu/utils';
export const metadata = { title: 'Order history' };
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser('/account/orders'),
    client = await createClient(),
    tenant = getRestaurantId();
  if (!tenant) throw new Error('Restaurant unavailable.');
  const customer = await client
    .from('restaurant_customers')
    .select('id')
    .eq('restaurant_id', tenant)
    .eq('user_id', user.id)
    .maybeSingle();
  if (customer.error) throw new Error('Unable to load your profile.');
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt((await searchParams).page || '1', 10) || 1),
  );
  const orders = customer.data
    ? await client
        .from('orders')
        .select('id,reference,status,method,total_minor,currency,created_at', { count: 'exact' })
        .eq('restaurant_id', tenant)
        .eq('customer_id', customer.data.id)
        .order('created_at', { ascending: false })
        .order('id')
        .range((page - 1) * 20, page * 20 - 1)
    : { data: [], error: null, count: 0 };
  if (orders.error) throw new Error('Unable to load your orders.');
  return (
    <section className="site-container max-w-4xl py-14">
      <h1 className="font-serif text-4xl">Your orders</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Orders placed with your account appear here. Guest orders use their private tracking link.
      </p>
      <div className="mt-8 space-y-4">
        {orders.data?.length ? (
          orders.data.map((order) => (
            <Link
              key={order.id}
              href={'/account/orders/' + order.id}
              className="block rounded-xl border bg-card p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <span className="break-all text-sm font-semibold">{order.reference}</span>
                <span className="text-sm">
                  {formatPrice(order.total_minor / 100, order.currency)}
                </span>
              </div>
              <p className="mt-3 text-sm capitalize">
                {order.status} · {order.method}
              </p>
              <time
                dateTime={order.created_at}
                className="mt-2 block text-xs text-muted-foreground"
              >
                {new Date(order.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
              </time>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border p-8 text-center text-muted-foreground">
            No orders to show yet.
          </p>
        )}
      </div>
      <nav aria-label="Order history pages" className="mt-6 flex justify-center gap-6">
        {page > 1 && (
          <Link href={'?page=' + (page - 1)} className="underline">
            Previous
          </Link>
        )}
        {page * 20 < (orders.count || 0) && (
          <Link href={'?page=' + (page + 1)} className="underline">
            Next
          </Link>
        )}
      </nav>
    </section>
  );
}
