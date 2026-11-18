import Link from 'next/link';
import { ShieldCheck, ArrowUpRight, LogOut } from 'lucide-react';
import { requireUser, getStaffAccess } from '@/features/auth/session';
import { logout } from '@/features/auth/actions';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { AccountForm } from '@/components/customer/account-form';
import { getRestaurantId } from '@/features/auth/config';
export const metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const access = await getStaffAccess();
  const client = await createClient();
  const { data: profile } = await client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const params = await searchParams;
  const tenant = getRestaurantId();
  const customer = tenant
    ? await client
        .from('restaurant_customers')
        .select('display_name,phone')
        .eq('restaurant_id', tenant)
        .eq('user_id', user.id)
        .maybeSingle()
    : null;
  if (customer?.error) throw new Error('Unable to load your profile.');
  return (
    <section className="site-container max-w-4xl py-16 sm:py-24">
      <p className="eyebrow text-brand-strong">Your corner of the table</p>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">
        Welcome{profile?.display_name ? `, ${profile.display_name}` : ' back'}.
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Manage your profile, saved addresses and order history.
      </p>
      {params.notice === 'signout_failed' && (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          Sign out could not complete. Please try again.
        </p>
      )}
      <div className="mt-8 rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h2 className="text-sm font-semibold">Account details</h2>
            <p className="mt-4 break-all text-sm">{user.email}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
              <ShieldCheck className="size-4" />
              Email verified
            </p>
          </div>
          <form action={logout}>
            <Button variant="outline" size="sm">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 border-t pt-6">
          <Button asChild size="sm" variant="outline">
            <Link href="/reset-password">Change password</Link>
          </Button>
          {access && (
            <Button asChild size="sm">
              <Link href="/admin">
                Open workspace <ArrowUpRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="mb-5 font-semibold">Your profile</h2>
        <AccountForm
          key={JSON.stringify([profile, customer?.data])}
          kind="profile"
          initial={{
            name: customer?.data?.display_name || profile?.display_name || '',
            phone: customer?.data?.phone || '',
          }}
        />
      </div>
      <p className="mt-6 text-xs leading-6 text-muted-foreground">
        Your verified sign-in email is used for your restaurant profile and account orders.
      </p>
    </section>
  );
}
