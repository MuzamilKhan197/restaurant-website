import { redirect } from 'next/navigation';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ tab: 'customers' });
  for (const key of ['q', 'page']) {
    if (typeof params[key] === 'string') query.set(key, params[key]);
  }
  redirect('/admin/people?' + query);
}
