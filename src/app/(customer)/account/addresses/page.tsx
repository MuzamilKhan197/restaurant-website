import Link from 'next/link';
import { requireUser } from '@/features/auth/session';
import { getRestaurantId } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { AccountForm } from '@/components/customer/account-form';
export const metadata = { title: 'Saved addresses' };
export default async function AddressesPage() {
  const user = await requireUser('/account/addresses'),
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
  if (!customer.data)
    return (
      <section className="site-container py-16">
        <h1 className="font-serif text-4xl">Saved addresses</h1>
        <p className="mt-5">Save your restaurant profile before adding an address.</p>
        <Link className="mt-4 inline-block underline" href="/account">
          Open profile
        </Link>
      </section>
    );
  const result = await client
    .from('customer_addresses')
    .select('id,label,address_line,area,city,instructions,is_default')
    .eq('restaurant_id', tenant)
    .eq('customer_id', customer.data.id)
    .order('is_default', { ascending: false })
    .order('created_at');
  if (result.error) throw new Error('Unable to load your addresses.');
  return (
    <section className="site-container py-14">
      <h1 className="font-serif text-4xl">Saved addresses</h1>
      {!result.data.length && (
        <p className="mt-5 text-sm text-muted-foreground">
          No saved addresses yet. Add one for your next order.
        </p>
      )}
      <div className="mt-8 grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
        {result.data.map((address) => (
          <article key={address.id} className="space-y-5 rounded-xl border bg-card p-6">
            <h2 className="font-semibold">
              {address.label}
              {address.is_default ? ' · Default' : ''}
            </h2>
            <AccountForm
              key={JSON.stringify(address)}
              kind="address"
              initial={{ ...address, instructions: address.instructions || '' }}
            />
            <AccountForm kind="delete" initial={{ id: address.id }} />
          </article>
        ))}
        <article className="rounded-xl border bg-card p-6">
          <h2 className="mb-5 font-semibold">Add an address</h2>
          <AccountForm kind="address" />
        </article>
      </div>
    </section>
  );
}
