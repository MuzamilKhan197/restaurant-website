import Link from 'next/link';
import { z } from 'zod';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/features/menu/utils';
import { OrderRefresh } from '@/components/admin/order-refresh';
export const metadata = { title: 'Orders' };
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requireStaff('orders.read'),
    client = await createClient(),
    params = await searchParams,
    page = Math.max(1, Math.min(10000, Number.parseInt(params.page || '1', 10) || 1));
  const states = [
      'pending',
      'accepted',
      'preparing',
      'ready',
      'completed',
      'rejected',
      'cancelled',
    ] as const,
    status = z.enum(states).safeParse(params.status);
  let request = client
    .from('orders')
    .select('id,reference,contact_name,status,method,total_minor,currency,created_at', {
      count: 'exact',
    })
    .eq('restaurant_id', access.restaurant_id)
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (status.success) request = request.eq('status', status.data);
  const result = await request;
  if (result.error) throw new Error('Unable to load orders.');
  const href = (p: number) =>
    '?' + new URLSearchParams({ page: String(p), status: status.success ? status.data : '' });
  return (
    <>
      <h1 className="text-3xl font-semibold">Orders</h1>
      <div className="mt-4">
        <OrderRefresh restaurantId={access.restaurant_id} />
      </div>
      <form className="my-6 flex gap-3">
        <label className="text-sm">
          Status
          <select
            name="status"
            defaultValue={status.success ? status.data : ''}
            className="ml-3 rounded-lg border bg-card p-3"
          >
            <option value="">All orders</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-primary px-5 py-3 text-sm text-primary-foreground">
          Filter
        </button>
      </form>
      <p className="mb-3 text-sm text-muted-foreground">{result.count || 0} orders</p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              {['Order', 'Customer', 'Status', 'Method', 'Total'].map((h) => (
                <th key={h} className="p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.length ? (
              result.data.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="p-4">
                    <Link href={'/admin/orders/' + o.id} className="underline">
                      {o.reference}
                    </Link>
                    <time
                      className="mt-2 block text-xs text-muted-foreground"
                      dateTime={o.created_at}
                    >
                      {new Date(o.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                    </time>
                  </td>
                  <td className="p-4">{o.contact_name}</td>
                  <td className="p-4 capitalize">{o.status}</td>
                  <td className="p-4 capitalize">{o.method}</td>
                  <td className="p-4">{formatPrice(o.total_minor / 100, o.currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No orders to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav aria-label="Order pages" className="mt-6 flex justify-center gap-6">
        {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
        {page * 25 < (result.count || 0) && <Link href={href(page + 1)}>Next</Link>}
      </nav>
    </>
  );
}
