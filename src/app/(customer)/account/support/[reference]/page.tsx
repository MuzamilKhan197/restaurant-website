import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/features/auth/session';
import { getRestaurantId } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { SupportConversation } from '@/components/customer/support-conversation';
import { readTicket } from '@/features/support/actions';
export const metadata = { title: 'Support conversation' };
export default async function AccountTicket({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const user = await requireUser('/account/support'),
    tenant = getRestaurantId(),
    client = await createClient(),
    reference = (await params).reference;
  if (!tenant) notFound();
  const customer = await client
    .from('restaurant_customers')
    .select('id')
    .eq('restaurant_id', tenant)
    .eq('user_id', user.id)
    .maybeSingle();
  if (customer.error) throw new Error('Unable to load your account.');
  if (!customer.data) notFound();
  const ticket = await client
    .from('support_tickets')
    .select('id')
    .eq('restaurant_id', tenant)
    .eq('customer_id', customer.data.id)
    .eq('reference', reference)
    .maybeSingle();
  if (ticket.error) throw new Error('Unable to load ticket.');
  if (!ticket.data) notFound();
  const result = await readTicket(reference, null);
  if (!result.ticket) throw new Error('Unable to load conversation.');
  return (
    <section className="site-container max-w-3xl py-14">
      <Link href="/account/support" className="mb-6 inline-block text-sm underline">
        All tickets
      </Link>
      <SupportConversation reference={reference} initial={result.ticket} />
    </section>
  );
}
