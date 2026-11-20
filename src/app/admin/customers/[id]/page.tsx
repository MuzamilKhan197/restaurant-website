import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/features/menu/utils';
export const metadata = { title: 'Customer details' };
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requireStaff('customers.read'),
    client = await createClient(),
    id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await client
    .from('restaurant_customers')
    .select('id,display_name,contact_email,phone,created_at')
    .eq('restaurant_id', access.restaurant_id)
    .eq('id', id)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load customer.');
  if (!result.data) notFound();
  const c = result.data;
  const filters = await searchParams;
  const canReadOrders = access.permissions.includes('orders.read');
  const page = Math.max(1, Math.min(10000, Number.parseInt(filters.page || '1', 10) || 1));
  const ticketPage = Math.max(
    1,
    Math.min(10000, Number.parseInt(filters.ticketPage || '1', 10) || 1),
  );
  const canReadTickets = access.permissions.includes('support.read');
  const [orders, tickets] = await Promise.all([
    canReadOrders
      ? client
          .from('orders')
          .select('id,reference,status,total_minor,currency,created_at', { count: 'exact' })
          .eq('restaurant_id', access.restaurant_id)
          .eq('customer_id', id)
          .order('created_at', { ascending: false })
          .order('id')
          .range((page - 1) * 20, page * 20 - 1)
      : null,
    canReadTickets
      ? client
          .from('support_tickets')
          .select('id,reference,subject,status', { count: 'exact' })
          .eq('restaurant_id', access.restaurant_id)
          .eq('customer_id', id)
          .order('updated_at', { ascending: false })
          .order('id')
          .range((ticketPage - 1) * 20, ticketPage * 20 - 1)
      : null,
  ]);
  if (tickets?.error) throw new Error('Unable to load customer tickets.');
  const historyHref = (orderPage: number, supportPage: number) =>
    '?' + new URLSearchParams({ page: String(orderPage), ticketPage: String(supportPage) });
  if (orders?.error) throw new Error('Unable to load customer orders.');
  return (
    <>
      <Link href="/admin/people?tab=customers" className="text-sm underline">
        All customers
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">{c.display_name}</h1>
      <div className="mt-6 space-y-3 rounded-xl border bg-card p-6">
        <p className="break-all text-sm">{c.contact_email}</p>
        <p className="text-sm">{c.phone || 'No phone saved'}</p>
      </div>
      <h2 className="mt-8 font-semibold">Order history</h2>
      {canReadOrders ? (
        <div className="mt-4 space-y-3">
          {orders?.data?.length ? (
            orders.data.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap justify-between gap-3 rounded-lg border bg-card p-4 text-sm"
              >
                <Link href={'/admin/orders/' + o.id} className="break-all underline">
                  {o.reference}
                </Link>
                <span className="capitalize">{o.status}</span>
                <span>{formatPrice(o.total_minor / 100, o.currency)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {orders?.count || 0} orders · Page {page}
          </p>
          <nav aria-label="Customer order pages" className="flex gap-6 text-sm">
            {page > 1 && <Link href={historyHref(page - 1, ticketPage)}>Previous</Link>}
            {page * 20 < (orders?.count || 0) && (
              <Link href={historyHref(page + 1, ticketPage)}>Next</Link>
            )}
          </nav>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Order access is required to view this history.
        </p>
      )}
      {tickets && (
        <section aria-labelledby="ticket-history" className="mt-8">
          <h2 id="ticket-history" className="font-semibold">
            Ticket history
          </h2>
          <div className="mt-4 space-y-3">
            {tickets.data.length ? (
              tickets.data.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-wrap justify-between gap-3 rounded-lg border bg-card p-4 text-sm"
                >
                  <div className="min-w-0">
                    <Link href={'/admin/support/' + ticket.id} className="break-words underline">
                      {ticket.subject}
                    </Link>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {ticket.reference}
                    </p>
                  </div>
                  <span className="capitalize">{ticket.status.replaceAll('_', ' ')}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            )}
            <nav aria-label="Customer ticket pages" className="flex gap-6 text-sm">
              {ticketPage > 1 && <Link href={historyHref(page, ticketPage - 1)}>Previous</Link>}
              {ticketPage * 20 < (tickets.count || 0) && (
                <Link href={historyHref(page, ticketPage + 1)}>Next</Link>
              )}
            </nav>
          </div>
        </section>
      )}
    </>
  );
}
