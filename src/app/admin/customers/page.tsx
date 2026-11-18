import Link from 'next/link';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
export const metadata = { title: 'Customers' };
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requireStaff('customers.read'),
    client = await createClient(),
    params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page || '1', 10) || 1)),
    search = (params.q || '').trim().slice(0, 100);
  let request = client
    .from('restaurant_customers')
    .select('id,display_name,contact_email,phone,created_at', { count: 'exact' })
    .eq('restaurant_id', access.restaurant_id)
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (search)
    request = request.ilike('display_name', '%' + search.replace(/[\\%_]/g, '\\$&') + '%');
  const result = await request;
  if (result.error) throw new Error('Unable to load customers.');
  const href = (p: number) => '?' + new URLSearchParams({ q: search, page: String(p) });
  return (
    <>
      <h1 className="text-3xl font-semibold">Customers</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Registered customers who saved a profile or placed an order with your restaurant.
      </p>
      <form className="my-6 flex flex-wrap gap-3">
        <label className="text-sm">
          Search by name
          <input
            className="ml-3 rounded-lg border bg-card p-3"
            name="q"
            defaultValue={search}
            maxLength={100}
          />
        </label>
        <button className="rounded-lg bg-primary px-5 py-3 text-sm text-primary-foreground">
          Search
        </button>
      </form>
      <p className="mb-3 text-sm text-muted-foreground">{result.count || 0} customers</p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Customer</th>
              <th className="p-4">Email</th>
              <th className="p-4">Phone</th>
            </tr>
          </thead>
          <tbody>
            {result.data.length ? (
              result.data.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-4">
                    <Link className="underline" href={'/admin/customers/' + c.id}>
                      {c.display_name}
                    </Link>
                  </td>
                  <td className="p-4">{c.contact_email}</td>
                  <td className="p-4">{c.phone || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted-foreground">
                  No customers match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav aria-label="Customer pages" className="mt-6 flex justify-center gap-6">
        {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
        {page * 25 < (result.count || 0) && <Link href={href(page + 1)}>Next</Link>}
      </nav>
    </>
  );
}
