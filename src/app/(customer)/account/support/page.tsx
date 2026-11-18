import Link from 'next/link';
import { requireUser } from '@/features/auth/session';
import { getRestaurantId } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Your support tickets' };
export default async function AccountSupport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser('/account/support'),
    tenant = getRestaurantId(),
    client = await createClient();
  if (!tenant) throw new Error('Restaurant unavailable.');
  const customer = await client
    .from('restaurant_customers')
    .select('id')
    .eq('restaurant_id', tenant)
    .eq('user_id', user.id)
    .maybeSingle();
  if (customer.error) throw new Error('Unable to load your account.');
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt((await searchParams).page || '1', 10) || 1),
  );
  const tickets = customer.data
    ? await client
        .from('support_tickets')
        .select('id,reference,subject,status,priority,updated_at', { count: 'exact' })
        .eq('restaurant_id', tenant)
        .eq('customer_id', customer.data.id)
        .order('updated_at', { ascending: false })
        .order('id')
        .range((page - 1) * 20, page * 20 - 1)
    : { data: [], error: null, count: 0 };
  if (tickets.error) throw new Error('Unable to load tickets.');
  return (
    <section className="site-container max-w-4xl py-14">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <h1 className="font-serif text-4xl">Your support tickets</h1>
        <Button asChild size="sm">
          <Link href="/support/new">Create ticket</Link>
        </Button>
      </div>
      <div className="mt-8 space-y-4">
        {tickets.data?.length ? (
          tickets.data.map((t) => (
            <Link
              key={t.id}
              className="block rounded-xl border bg-card p-5"
              href={'/account/support/' + t.reference}
            >
              <p className="break-all text-xs text-muted-foreground">{t.reference}</p>
              <h2 className="mt-2 font-semibold">{t.subject}</h2>
              <p className="mt-3 text-sm capitalize">
                {t.status.replaceAll('_', ' ')} · {t.priority}
              </p>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            No tickets yet. Guest tickets use their own private links.
          </p>
        )}
      </div>
      <nav aria-label="Ticket pages" className="mt-5 flex justify-center gap-6 text-sm">
        {page > 1 && <Link href={'?page=' + (page - 1)}>Previous</Link>}
        {page * 20 < (tickets.count || 0) && <Link href={'?page=' + (page + 1)}>Next</Link>}
      </nav>
    </section>
  );
}
