import Link from 'next/link';
import { requireStaff } from '@/features/auth/session';
import { getReportContext, getSalesReport } from '@/features/reports/data';
import { defaultRange, reportRangeSchema, formatMinor } from '@/features/reports/model';
import { ReportRange } from '@/components/admin/report-range';
import { SalesChart } from '@/components/admin/sales-chart';
export const metadata = { title: 'Sales reports' };
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaff('reports.read');
  const { access, restaurant } = await getReportContext(),
    params = await searchParams,
    defaults = defaultRange(restaurant.timezone);
  const range = reportRangeSchema.safeParse({
    from: params.from ?? defaults.from,
    to: params.to ?? defaults.to,
  });
  const controls = (
    <ReportRange
      from={range.success ? range.data.from : defaults.from}
      to={range.success ? range.data.to : defaults.to}
      timezone={restaurant.timezone}
      path="/admin/reports"
    />
  );
  if (!range.success)
    return (
      <>
        <h1 className="text-3xl font-semibold">Sales reports</h1>
        {controls}
        <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
          {range.error.issues[0].message}
        </p>
      </>
    );
  const report = await getSalesReport(range.data.from, range.data.to),
    price = (amount: string) => formatMinor(amount, report.currency),
    query = new URLSearchParams(range.data);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold">Sales reports</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            Order statistics use order creation dates. Cash received and refunds use their actual
            payment dates. All dates follow your restaurant timezone.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={'/admin/reports/export?' + query + '&type=daily'}
            download
            prefetch={false}
            className="rounded-lg border bg-card px-4 py-3"
          >
            Download daily CSV
          </Link>
          <Link
            href={'/admin/reports/export?' + query + '&type=popular'}
            download
            prefetch={false}
            className="rounded-lg border bg-card px-4 py-3"
          >
            Download product CSV
          </Link>
        </div>
      </div>
      {controls}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            'Completed sales',
            price(report.summary.completed_sales_minor),
            'Completed orders created in this period',
          ],
          ['Cash received', price(report.cash.received_minor), 'Cash recorded during this period'],
          [
            'Cash refunded',
            price(report.cash.refunded_minor),
            'Refunds recorded during this period',
          ],
          [
            'Net cash flow',
            price(report.cash.net_minor),
            'Cash received minus refunds; may be negative',
          ],
          [
            'All orders',
            report.summary.total_orders.toLocaleString('en-PK'),
            'Includes pending, rejected and cancelled',
          ],
          [
            'Completed orders',
            report.summary.completed_orders.toLocaleString('en-PK'),
            'Fulfilled orders created in this period',
          ],
          [
            'Average completed order',
            price(report.summary.average_completed_minor),
            'Completed sales divided by completed orders',
          ],
          [
            'Awaiting cash collection',
            price(report.summary.unpaid_minor),
            'Unpaid accepted/active/completed orders in period',
          ],
        ].map(([label, value, hint]) => (
          <article key={label} className="min-w-0 rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-4 break-words text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-3 text-[10px] leading-5 text-muted-foreground">{hint}</p>
          </article>
        ))}
      </div>
      <p className="my-5 text-xs text-muted-foreground">
        Refunds still due for orders created in this period:{' '}
        <span className="font-semibold text-foreground">
          {price(report.summary.refund_due_minor)}
        </span>
        . Unaccepted pending orders are excluded from cash awaiting collection.
      </p>
      <SalesChart daily={report.daily} currency={report.currency} />
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="min-w-0 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Popular dishes</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Top 10 by units in completed orders. Item sales include extras and exclude order-level
            delivery and tax. Names come from the latest completed sale.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-4">Dish</th>
                  <th className="py-3 pr-4">Units</th>
                  <th className="py-3 pr-4">Orders</th>
                  <th className="py-3">Item sales</th>
                </tr>
              </thead>
              <tbody>
                {report.popular.length ? (
                  report.popular.map((p) => (
                    <tr key={p.product_id} className="border-b last:border-0">
                      <td className="py-4 pr-4">
                        {access.permissions.some((p) =>
                          ['menu.read', 'menu.manage'].includes(p),
                        ) ? (
                          <Link href={'/admin/menu/' + p.product_id} className="underline">
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="py-4 pr-4">{p.units}</td>
                      <td className="py-4 pr-4">{p.orders}</td>
                      <td className="py-4">{price(p.sales_minor)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No completed sales in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Order statuses</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Orders created within the selected period.
          </p>
          <dl className="mt-5 space-y-4">
            {report.statuses.map((s) => (
              <div key={s.status}>
                <div className="flex justify-between text-xs">
                  <dt className="capitalize">{s.status}</dt>
                  <dd>{s.count}</dd>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{
                      width:
                        (report.summary.total_orders
                          ? (s.count / report.summary.total_orders) * 100
                          : 0) + '%',
                    }}
                  />
                </div>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <details className="mt-6 rounded-xl border bg-card p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Daily figures ({report.daily.length} days)
        </summary>
        <div className="mt-5 max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b">
                {[
                  'Date',
                  'All orders',
                  'Completed',
                  'Completed sales',
                  'Cash received',
                  'Refunds',
                  'Net cash',
                ].map((label) => (
                  <th className="whitespace-nowrap p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.daily.map((d) => (
                <tr key={d.date} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-3">{d.date}</td>
                  <td className="p-3">{d.orders}</td>
                  <td className="p-3">{d.completed}</td>
                  <td className="whitespace-nowrap p-3">{price(d.sales_minor)}</td>
                  <td className="whitespace-nowrap p-3">{price(d.received_minor)}</td>
                  <td className="whitespace-nowrap p-3">{price(d.refunded_minor)}</td>
                  <td className="whitespace-nowrap p-3">
                    {formatMinor(
                      BigInt(d.received_minor) - BigInt(d.refunded_minor),
                      report.currency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
