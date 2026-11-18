import Link from 'next/link';
import { z } from 'zod';
import { requireStaff } from '@/features/auth/session';
import { getReportContext, getActivity } from '@/features/reports/data';
import { defaultRange, reportRangeSchema, entityNames } from '@/features/reports/model';
import { ReportRange } from '@/components/admin/report-range';
export const metadata = { title: 'Activity log' };
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaff('audit.read');
  const { access, restaurant } = await getReportContext(),
    params = await searchParams,
    defaults = defaultRange(restaurant.timezone),
    range = reportRangeSchema.safeParse({
      from: params.from ?? defaults.from,
      to: params.to ?? defaults.to,
    });
  const entity = params.entity || '',
    action = params.action || '',
    actor = params.actor || '',
    page = Math.max(1, Math.min(10000, Number.parseInt(params.page || '1', 10) || 1));
  const validFilters =
    (!entity || /^[a-z_]{1,60}$/.test(entity)) &&
    (!action || /^[a-z_.]{1,64}$/.test(action)) &&
    (!actor || z.uuid().safeParse(actor).success);
  const controls = (
    <ReportRange
      from={range.success ? range.data.from : defaults.from}
      to={range.success ? range.data.to : defaults.to}
      timezone={restaurant.timezone}
      path="/admin/activity"
    >
      <label className="text-xs">
        Record type
        <select
          name="entity"
          defaultValue={entity}
          className="mt-2 block rounded-lg border bg-background p-3"
        >
          <option value="">All records</option>
          {Object.entries(entityNames).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Action
        <select
          name="action"
          defaultValue={action}
          className="mt-2 block rounded-lg border bg-background p-3"
        >
          <option value="">All actions</option>
          {['insert', 'update', 'delete'].map((a) => (
            <option value={a} key={a}>
              {a === 'insert' ? 'Created' : a === 'update' ? 'Updated' : 'Deleted'}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Actor ID (optional)
        <input
          name="actor"
          defaultValue={actor}
          maxLength={36}
          placeholder="Account UUID"
          className="mt-2 block w-64 rounded-lg border bg-background p-3"
        />
      </label>
    </ReportRange>
  );
  if (!range.success || !validFilters)
    return (
      <>
        <h1 className="text-3xl font-semibold">Activity log</h1>
        {controls}
        <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
          Choose valid dates and filters. Actor ID must be a complete account UUID.
        </p>
      </>
    );
  const data = await getActivity(range.data.from, range.data.to, { entity, action, actor, page }),
    href = (p: number) =>
      '?' + new URLSearchParams({ ...range.data, entity, action, actor, page: String(p) });
  function recordLink(type: string, id: string | null) {
    if (!id || !z.uuid().safeParse(id).success) return null;
    const routes: Record<string, [string, string[]]> = {
      orders: ['/admin/orders/', ['orders.read']],
      products: ['/admin/menu/', ['menu.read', 'menu.manage']],
      support_tickets: ['/admin/support/', ['support.read']],
      restaurant_customers: ['/admin/customers/', ['customers.read']],
    };
    const route = routes[type];
    return route && route[1].some((p) => access.permissions.includes(p)) ? route[0] + id : null;
  }
  return (
    <>
      <h1 className="text-3xl font-semibold">Activity log</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        Review recorded changes to your restaurant. Actor names reflect current staff names. Message
        bodies, customer contacts and file contents are excluded.
      </p>
      {controls}
      <p className="mb-4 text-xs text-muted-foreground">
        {data.count.toLocaleString('en-PK')} recorded actions · Page {page}
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              {['When', 'Actor', 'Action', 'Record'].map((h) => (
                <th key={h} className="p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.entries.length ? (
              data.entries.map((entry) => {
                const link = recordLink(entry.entity_type, entry.entity_id);
                return (
                  <tr key={entry.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap p-4 text-xs">
                      <time dateTime={entry.created_at}>
                        {new Date(entry.created_at).toLocaleString('en-PK', {
                          timeZone: data.timezone,
                        })}
                      </time>
                    </td>
                    <td className="p-4">
                      <p>{entry.actor_name}</p>
                      {entry.actor_user_id && (
                        <details className="mt-2 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">Actor ID</summary>
                          <code className="mt-2 block break-all">{entry.actor_user_id}</code>
                        </details>
                      )}
                    </td>
                    <td className="p-4">
                      {entry.action === 'insert'
                        ? 'Created'
                        : entry.action === 'update'
                          ? 'Updated'
                          : entry.action === 'delete'
                            ? 'Deleted'
                            : entry.action.replaceAll('_', ' ')}
                    </td>
                    <td className="p-4">
                      <p>
                        {entityNames[entry.entity_type] || entry.entity_type.replaceAll('_', ' ')}
                      </p>
                      {entry.entity_id && (
                        <details className="mt-2 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">Record reference</summary>
                          {link ? (
                            <Link href={link} className="mt-2 block break-all underline">
                              {entry.entity_id}
                            </Link>
                          ) : (
                            <code className="mt-2 block break-all">{entry.entity_id}</code>
                          )}
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No activity matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav aria-label="Activity pages" className="mt-6 flex justify-center gap-6 text-sm">
        {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
        {page * 50 < data.count && <Link href={href(page + 1)}>Next</Link>}
      </nav>
    </>
  );
}
