import Link from 'next/link';
import { z } from 'zod';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { statuses, priorities } from '@/features/support/validation';
export const metadata = { title: 'Support inbox' };
export default async function SupportInbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireStaff('support.read'),
    client = await createClient(),
    params = await searchParams,
    page = Math.max(
      1,
      Math.min(
        10000,
        Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1,
      ),
    ),
    query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const status = z.enum(statuses).safeParse(params.status),
    priority = z.enum(priorities).safeParse(params.priority),
    assigned = z.uuid().safeParse(params.assigned);
  const assignees = access.permissions.includes('support.manage')
    ? await client.rpc('support_assignees', { p_restaurant: access.restaurant_id })
    : null;
  const choices = z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .safeParse(assignees?.data || []);
  if (assignees?.error || !choices.success) throw new Error('Unable to load support assignments.');
  let request = client
    .from('support_tickets')
    .select('id,reference,subject,contact_name,status,priority,assigned_to,updated_at', {
      count: 'exact',
    })
    .eq('restaurant_id', access.restaurant_id)
    .order('updated_at', { ascending: false })
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (status.success) request = request.eq('status', status.data);
  if (priority.success) request = request.eq('priority', priority.data);
  if (assigned.success) request = request.eq('assigned_to', assigned.data);
  else if (params.assigned === 'unassigned') request = request.is('assigned_to', null);
  if (query) {
    // Quote the entire PostgREST value so commas, quotes and parentheses stay in the search term.
    const pattern = JSON.stringify('%' + query.replace(/[\\%_]/g, (char) => '\\' + char) + '%');
    request = request.or(
      ['reference', 'contact_name', 'subject']
        .map((column) => column + '.ilike.' + pattern)
        .join(','),
    );
  }
  const result = await request;
  if (result.error) throw new Error('Unable to load support tickets.');
  const href = (p: number) =>
    '?' +
    new URLSearchParams({
      page: String(p),
      q: query,
      status: status.success ? status.data : '',
      priority: priority.success ? priority.data : '',
      assigned: assigned.success
        ? assigned.data
        : params.assigned === 'unassigned'
          ? 'unassigned'
          : '',
    });
  return (
    <>
      <h1 className="text-3xl font-semibold">Support inbox</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Customer requests, private conversations and internal staff notes.
      </p>
      <form className="my-6 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          Search ticket number, name or subject
          <input
            name="q"
            defaultValue={query}
            maxLength={100}
            className="mt-2 block rounded-lg border bg-card p-3"
          />
        </label>
        {[
          ['status', 'Status', statuses, status.success ? status.data : ''],
          ['priority', 'Priority', priorities, priority.success ? priority.data : ''],
        ].map(([name, label, options, value]) => (
          <label key={String(name)} className="text-xs">
            {label}
            <select
              name={String(name)}
              defaultValue={String(value)}
              className="mt-2 block rounded-lg border bg-card p-3"
            >
              <option value="">All</option>
              {(options as readonly string[]).map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="text-xs">
          Assignment
          <select
            name="assigned"
            defaultValue={typeof params.assigned === 'string' ? params.assigned : ''}
            className="mt-2 block rounded-lg border bg-card p-3"
          >
            <option value="">All assignments</option>
            <option value="unassigned">Unassigned</option>
            {choices.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-primary px-5 py-3 text-sm text-primary-foreground">
          Filter
        </button>
        <Link href="/admin/support" className="p-3 text-xs underline">
          Refresh / clear
        </Link>
      </form>
      <p className="mb-3 text-sm text-muted-foreground">{result.count || 0} tickets</p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              {['Ticket', 'Opened by', 'Status', 'Priority', 'Assignment', 'Updated'].map((h) => (
                <th className="p-4" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.length ? (
              result.data.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-4">
                    <Link href={'/admin/support/' + t.id} className="font-semibold underline">
                      {t.subject}
                    </Link>
                    <p className="mt-2 text-xs text-muted-foreground">{t.reference}</p>
                  </td>
                  <td className="p-4">{t.contact_name}</td>
                  <td className="p-4 capitalize">{t.status.replaceAll('_', ' ')}</td>
                  <td
                    className={
                      'p-4 capitalize ' +
                      (['urgent', 'high'].includes(t.priority) ? 'font-semibold text-red-700' : '')
                    }
                  >
                    {t.priority}
                  </td>
                  <td className="p-4">
                    {choices.data.find((a) => a.id === t.assigned_to)?.name ||
                      (t.assigned_to ? 'Assigned staff' : 'Unassigned')}
                  </td>
                  <td className="p-4 text-xs">
                    {new Date(t.updated_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No tickets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav aria-label="Support pages" className="mt-6 flex justify-center gap-6 text-sm">
        {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
        {page * 25 < (result.count || 0) && <Link href={href(page + 1)}>Next</Link>}
      </nav>
    </>
  );
}
