import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Flame } from 'lucide-react';
import { getPublicRestaurant } from '@/features/storefront/data';

export const metadata = { title: 'Restaurant maintenance', robots: { index: false } };
export default async function MaintenancePage() {
  const context = await getPublicRestaurant();
  if (context.state !== 'maintenance') redirect('/');
  const reopening = context.settings?.reopening_at;
  return (
    <main className="grid min-h-screen place-items-center bg-[#FAF7F2] px-6 py-16 text-[#171717]">
      <section className="w-full max-w-xl rounded-3xl border border-orange-100 bg-white p-8 text-center sm:p-12">
        <Flame
          aria-hidden="true"
          className="mx-auto size-12 rounded-xl bg-[#171717] p-2 text-orange-400"
        />
        <p className="mt-4 text-sm font-semibold">{context.restaurant?.name}</p>
        <h1 className="mt-6 font-serif text-4xl">We’ll be back soon</h1>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">
          {context.settings?.maintenance_message}
        </p>
        {reopening && new Date(reopening) > new Date() && (
          <p className="mt-4 text-sm">
            Expected reopening{' '}
            <time dateTime={reopening}>
              {new Intl.DateTimeFormat('en-PK', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: context.restaurant?.timezone,
              }).format(new Date(reopening))}
            </time>{' '}
            ({context.restaurant?.timezone})
          </p>
        )}
        <nav
          aria-label="Existing orders and support"
          className="mt-8 flex flex-wrap justify-center gap-5 text-sm"
        >
          <Link href="/account/orders" className="underline">
            My orders
          </Link>
          <Link href="/help" className="underline">
            Help center
          </Link>
        </nav>
      </section>
    </main>
  );
}
