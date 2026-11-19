import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'People Access' };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireStaff();
  const canSeeStaff =
    access.permissions.includes('people.read') && access.permissions.includes('staff.read');
  const canSeeCustomers = access.permissions.includes('customers.read');
  const canSeeAll =
    canSeeStaff && canSeeCustomers && (access.can_manage_all_staff_roles ?? access.is_owner);
  const tabs = [
    { id: 'all', label: 'All', visible: canSeeAll },
    { id: 'staff', label: 'Staff', visible: canSeeStaff },
    { id: 'customers', label: 'Customers', visible: canSeeCustomers },
  ].filter(({ visible }) => visible);
  const params = await searchParams;
  const tab = (tabs.find(({ id }) => id === params.tab) || tabs[0])?.id;
  if (!tab) redirect('/access-denied');
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = Math.min(
    10000,
    Math.max(1, typeof params.page === 'string' ? Number.parseInt(params.page, 10) || 1 : 1),
  );
  const client = await createClient();
  const first = (page - 1) * 25;
  const loadPeople = async () => {
    if (tab === 'all') {
      const { data, error, count } = await client
        .rpc(
          'list_people_profiles',
          { p_restaurant: access.restaurant_id, p_query: query },
          { count: 'exact' },
        )
        .order('display_name')
        .order('id')
        .range(first, first + 24);
      if (error) throw new Error('Unable to load account profiles.');
      return { count, people: data };
    }
    const request = client
      .from(tab === 'staff' ? 'staff_memberships' : 'restaurant_customers')
      .select('id,display_name,contact_email', { count: 'exact' })
      .eq('restaurant_id', access.restaurant_id)
      .order('display_name')
      .order('id')
      .range(first, first + 24);
    const { data, error, count } = await (query
      ? request.ilike('display_name', '%' + query.replace(/[\\%_]/g, '\\$&') + '%')
      : request);
    if (error) throw new Error('Unable to load the people directory.');
    return {
      count,
      people: data.map((person) => ({
        id: person.id,
        display_name: person.display_name,
        email: person.contact_email,
        staff_id: tab === 'staff' ? person.id : null,
        customer_id: tab === 'customers' ? person.id : null,
      })),
    };
  };
  const { people, count } = await loadPeople();
  const href = (value: number) =>
    '/admin/people?' + new URLSearchParams({ tab, q: query, page: String(value) });
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">People Access</h1>
      <nav aria-label="People groups" className="flex gap-3">
        {tabs.map(({ id, label }) => (
          <Button key={id} asChild size="sm" variant={tab === id ? 'default' : 'outline'}>
            <Link href={`/admin/people?tab=${id}`} aria-current={tab === id ? 'page' : undefined}>
              {label}
            </Link>
          </Button>
        ))}
      </nav>
      <form action="/admin/people" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <label className="text-sm">
          {tab === 'all' ? 'Search by name or email' : 'Search by name'}
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
        {count || 0}{' '}
        {tab === 'all' ? 'profiles' : tab === 'staff' ? 'staff members' : 'registered customers'}
      </p>
      <div className="divide-y rounded-xl border bg-card">
        {!people.length && (
          <p className="p-6 text-sm text-muted-foreground">No people found.</p>
        )}
        {people.map((person) => (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="break-words font-medium">{person.display_name || 'Unnamed account'}</p>
              {person.email && (
                <p className="break-all text-sm text-muted-foreground">{person.email}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {person.staff_id && (
                <Link className="underline" href={'/admin/staff#' + person.staff_id}>
                  View staff access
                </Link>
              )}
              {person.customer_id && (
                <Link className="underline" href={'/admin/customers/' + person.customer_id}>
                  View customer profile
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      <nav aria-label="Directory pages" className="flex gap-5 text-sm">
        {page > 1 && (
          <Link href={href(page - 1)} className="underline">
            Previous
          </Link>
        )}
        {page * 25 < (count || 0) && (
          <Link href={href(page + 1)} className="underline">
            Next
          </Link>
        )}
      </nav>
    </section>
  );
}
