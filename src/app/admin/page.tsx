import Link from 'next/link';
import { getReportContext, getSalesReport } from '@/features/reports/data';
import { createClient } from '@/lib/supabase/server';
import { defaultRange, formatMinor } from '@/features/reports/model';
import { formatPrice } from '@/features/menu/utils';
import { adminModules } from '@/lib/site';
import { visibleModule } from '@/features/auth/permissions';
import { SalesChart } from '@/components/admin/sales-chart';
import { Button } from '@/components/ui/button';
export default async function WorkspaceOverview() {
  const { access, restaurant } = await getReportContext(),
    client = await createClient(),
    can = (p: string) => access.permissions.includes(p),
    range = defaultRange(restaurant.timezone, new Date(), 7);
  const [orders, pending, active, recent, customers, support, report] = await Promise.all([
    can('orders.read')
      ? client
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', access.restaurant_id)
      : null,
    can('orders.read')
      ? client
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', access.restaurant_id)
          .eq('status', 'pending')
      : null,
    can('orders.read')
      ? client
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', access.restaurant_id)
          .in('status', ['accepted', 'preparing', 'ready'])
      : null,
    can('orders.read')
      ? client
          .from('orders')
          .select('id,reference,status,method,total_minor,currency,created_at')
          .eq('restaurant_id', access.restaurant_id)
          .order('created_at', { ascending: false })
          .order('id')
          .limit(8)
      : null,
    can('customers.read')
      ? client
          .from('restaurant_customers')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', access.restaurant_id)
      : null,
    can('support.read')
      ? client
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', access.restaurant_id)
          .not('status', 'in', '(resolved,closed)')
      : null,
    can('reports.read') ? getSalesReport(range.from, range.to) : null,
  ]);
  if ([orders, pending, active, recent, customers, support].some((result) => result?.error))
    throw new Error('Unable to load restaurant overview. Please retry.');
  const cards: [string, string, string, string][] = [];
  if (orders)
    cards.push([
      'Total orders',
      (orders.count || 0).toLocaleString('en-PK'),
      'All recorded orders',
      '/admin/orders',
    ]);
  if (pending)
    cards.push([
      'Pending acceptance',
      (pending.count || 0).toLocaleString('en-PK'),
      'Orders waiting for your team',
      '/admin/orders?status=pending',
    ]);
  if (active)
    cards.push([
      'In progress',
      (active.count || 0).toLocaleString('en-PK'),
      'Accepted, preparing or ready',
      '/admin/orders',
    ]);
  if (customers)
    cards.push([
      'Registered customers',
      (customers.count || 0).toLocaleString('en-PK'),
      'Saved restaurant profiles',
      '/admin/customers',
    ]);
  if (support)
    cards.push([
      'Open support tickets',
      (support.count || 0).toLocaleString('en-PK'),
      'Unresolved customer requests',
      '/admin/support',
    ]);
  if (report)
    cards.push(
      [
        'Cash received',
        formatMinor(report.cash.received_minor, report.currency),
        'Cash collected in the last 7 days',
        '/admin/reports',
      ],
      [
        'Completed sales',
        formatMinor(report.summary.completed_sales_minor, report.currency),
        'Completed orders created in the last 7 days',
        '/admin/reports',
      ],
      [
        'Net cash flow',
        formatMinor(report.cash.net_minor, report.currency),
        'Receipts minus refunds in the last 7 days',
        '/admin/reports',
      ],
    );
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow text-[9px]">Your restaurant, in one place</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{restaurant.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Today&apos;s priorities and your latest business activity.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/">View storefront</Link>
        </Button>
      </div>
      {cards.length ? (
        <section
          aria-label="Restaurant metrics"
          className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {cards.map(([label, value, hint, href]) => (
            <Link
              key={label}
              href={href}
              className="min-w-0 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-4 break-words text-3xl font-semibold tracking-tight">{value}</p>
              <p className="mt-3 text-[10px] leading-5 text-muted-foreground">{hint}</p>
            </Link>
          ))}
        </section>
      ) : (
        <p className="mt-7 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Your role has no operational metrics. Choose an available tool below.
        </p>
      )}
      {report && (
        <div className="mt-6">
          <SalesChart daily={report.daily} currency={report.currency} />
          <Link href="/admin/reports" className="mt-4 inline-block text-xs underline">
            View full sales reports
          </Link>
        </div>
      )}
      {recent && (
        <section className="mt-6 rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs underline">
              All orders
            </Link>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  {['Order', 'Status', 'Method', 'Total', 'Placed'].map((h) => (
                    <th key={h} className="py-3 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.data?.length ? (
                  recent.data.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-4 pr-4">
                        <Link href={'/admin/orders/' + o.id} className="underline">
                          {o.reference}
                        </Link>
                      </td>
                      <td className="py-4 pr-4 capitalize">{o.status}</td>
                      <td className="py-4 pr-4 capitalize">{o.method}</td>
                      <td className="whitespace-nowrap py-4 pr-4">
                        {formatPrice(o.total_minor / 100, o.currency)}
                      </td>
                      <td className="whitespace-nowrap py-4 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString('en-PK', {
                          timeZone: restaurant.timezone,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No orders yet. New orders will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="mt-8">
        <h2 className="font-semibold">Quick access</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {adminModules
            .filter((module) => visibleModule(module.slug, access.permissions))
            .map((module) => (
              <Link
                key={module.slug}
                href={'/admin/' + module.slug}
                className="rounded-xl border bg-card p-5 transition-colors hover:border-primary"
              >
                <h3 className="text-sm font-semibold">{module.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{module.description}</p>
              </Link>
            ))}
        </div>
      </section>
      <p className="mt-8 text-xs text-muted-foreground">
        Financial metrics: {range.from} through {range.to}, inclusive. Timezone:{' '}
        {restaurant.timezone}. Operational counts reflect current records.
      </p>
    </>
  );
}
