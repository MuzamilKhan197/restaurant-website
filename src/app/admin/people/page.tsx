import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'People' };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireStaff('people.read');
  const canSeeStaff = access.permissions.includes('staff.read');
  const canSeeCustomers = access.permissions.includes('customers.read');
  if (!canSeeStaff && !canSeeCustomers) redirect('/access-denied');
  const params = await searchParams;
  const staff = canSeeStaff && (params.tab !== 'customers' || !canSeeCustomers);
  const tab = staff ? 'staff' : 'customers';
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = Math.min(
    10000,
    Math.max(1, typeof params.page === 'string' ? Number.parseInt(params.page, 10) || 1 : 1),
  );
  const client = await createClient();
  const selection = 'id,display_name,contact_email';
  const base = staff
    ? client.from('staff_memberships').select(selection, { count: 'exact' })
    : client.from('restaurant_customers').select(selection, { count: 'exact' });
  const request = base
    .eq('restaurant_id', access.restaurant_id)
    .order('display_name')
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  const result = await (query
    ? request.ilike('display_name', '%' + query.replace(/[\\%_]/g, '\\$&') + '%')
    : request);
  if (result.error) throw new Error('Unable to load the people directory.');
  const href = (value: number) =>
    '/admin/people?' + new URLSearchParams({ tab, q: query, page: String(value) });
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">People</h1>
      <nav aria-label="People groups" className="flex gap-3">
        {canSeeStaff && (
          <Button asChild size="sm" variant={staff ? 'default' : 'outline'}>
            <Link href="/admin/people?tab=staff" aria-current={staff ? 'page' : undefined}>
              Staff
            </Link>
          </Button>
        )}
        {canSeeCustomers && (
          <Button asChild size="sm" variant={!staff ? 'default' : 'outline'}>
            <Link href="/admin/people?tab=customers" aria-current={!staff ? 'page' : undefined}>
              Customers
            </Link>
          </Button>
        )}
      </nav>
      <form action="/admin/people" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <label className="text-sm">
          Search by name
          <input
            name="q"
            maxLength={100}
            defaultValue={query}
            className="mt-1 block rounded-lg border bg-card px-3 py-2"
          />
        </label>
        <Button size="sm">Search</Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {result.count || 0} {staff ? 'staff members' : 'registered customers'}
      </p>
      <div className="divide-y rounded-xl border bg-card">
        {!result.data.length && (
          <p className="p-6 text-sm text-muted-foreground">No people found.</p>
        )}
        {result.data.map((person) => (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="break-words font-medium">{person.display_name || 'Unnamed account'}</p>
              {person.contact_email && (
                <p className="break-all text-sm text-muted-foreground">{person.contact_email}</p>
              )}
            </div>
            <Link
              className="text-sm underline"
              href={staff ? '/admin/staff#' + person.id : '/admin/customers/' + person.id}
            >
              {staff ? 'View staff access' : 'View profile'}
            </Link>
          </div>
        ))}
      </div>
      <nav aria-label="Directory pages" className="flex gap-5 text-sm">
        {page > 1 && (
          <Link href={href(page - 1)} className="underline">
            Previous
          </Link>
        )}
        {page * 25 < (result.count || 0) && (
          <Link href={href(page + 1)} className="underline">
            Next
          </Link>
        )}
      </nav>
    </section>
  );
}
