import { publicClient } from '@/features/storefront/data';
import { requireStorefrontAvailable } from '@/features/storefront/availability';
import { getVerifiedUser } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getRestaurantId } from '@/features/auth/config';
import { Checkout } from '@/components/customer/checkout';
export const metadata = { title: 'Your cart' };
export const dynamic = 'force-dynamic';
export default async function CartPage() {
  const context = await requireStorefrontAvailable(),
    publicDb = publicClient(),
    tenant = getRestaurantId(),
    user = await getVerifiedUser();
  const zones =
    context.state === 'ready' && publicDb && tenant
      ? await publicDb
          .from('delivery_zones')
          .select('id,name')
          .eq('restaurant_id', tenant)
          .eq('is_active', true)
          .order('name')
      : null;
  const client = user ? await createClient() : null;
  const customer =
    user && client && tenant
      ? await client
          .from('restaurant_customers')
          .select('id,display_name,phone')
          .eq('restaurant_id', tenant)
          .eq('user_id', user.id)
          .maybeSingle()
      : null;
  const addresses =
    customer?.data && client && tenant
      ? await client
          .from('customer_addresses')
          .select('id,label,address_line,area,city,instructions')
          .eq('restaurant_id', tenant)
          .eq('customer_id', customer.data.id)
          .order('is_default', { ascending: false })
      : null;
  if (zones?.error || customer?.error || addresses?.error)
    throw new Error('Unable to load checkout. Please retry.');
  return (
    <section className="site-container py-14">
      <Checkout
        zones={zones?.data || []}
        available={context.state === 'ready' && context.settings?.website_mode === 'normal'}
        deliveryEnabled={Boolean(context.settings?.delivery_enabled)}
        initial={{
          name: customer?.data?.display_name || '',
          email: user?.email || '',
          phone: customer?.data?.phone || '',
        }}
        addresses={addresses?.data || []}
      />
    </section>
  );
}
