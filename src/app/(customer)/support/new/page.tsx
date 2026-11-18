import Link from 'next/link';
import { getVerifiedUser } from '@/features/auth/session';
import { getRestaurantId } from '@/features/auth/config';
import { createClient } from '@/lib/supabase/server';
import { SupportCreateForm } from '@/components/customer/support-create-form';
export const metadata = { title: 'Contact support' };
export const dynamic = 'force-dynamic';
export default async function NewSupport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getVerifiedUser(),
    tenant = getRestaurantId(),
    client = user ? await createClient() : null;
  const profile =
    user && client
      ? await client.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      : null;
  if (profile?.error) throw new Error('Unable to load your profile. Please retry.');
  const order = (await searchParams).order || '';
  return (
    <section className="site-container max-w-3xl py-14">
      <Link href="/help" className="text-sm underline">
        Help center
      </Link>
      <h1 className="mt-5 font-serif text-4xl">We&apos;re here to help.</h1>
      <p className="mb-8 mt-4 text-sm leading-7 text-muted-foreground">
        Questions, order problems or feedback: send a private message to the restaurant. Guests can
        create tickets without an account.
      </p>
      {!tenant ? (
        <p role="alert">Support is temporarily unavailable.</p>
      ) : (
        <SupportCreateForm
          initial={{ name: profile?.data?.display_name || '', email: user?.email || '' }}
          orderReference={/^ORD-[A-Z0-9-]{1,40}$/.test(order) ? order : ''}
        />
      )}
    </section>
  );
}
