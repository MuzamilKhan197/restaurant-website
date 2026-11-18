import Link from 'next/link';
import { defaultRange } from '@/features/reports/model';
export function ReportRange({
  from,
  to,
  timezone,
  path,
  children,
}: {
  from: string;
  to: string;
  timezone: string;
  path: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="my-6 rounded-xl border bg-card p-5">
      <form key={from + ':' + to} action={path} className="flex flex-wrap items-end gap-4">
        <label className="text-xs">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            min="2000-01-01"
            max="2100-12-31"
            required
            className="mt-2 block rounded-lg border bg-background p-3"
          />
        </label>
        <label className="text-xs">
          Through (inclusive)
          <input
            type="date"
            name="to"
            defaultValue={to}
            min="2000-01-01"
            max="2100-12-31"
            required
            className="mt-2 block rounded-lg border bg-background p-3"
          />
        </label>
        {children}
        <button className="rounded-lg bg-primary px-5 py-3 text-sm text-primary-foreground">
          Apply filters
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>Timezone: {timezone}</span>
        {[7, 30, 90].map((days) => (
          <Link
            key={days}
            href={path + '?' + new URLSearchParams(defaultRange(timezone, new Date(), days))}
            className="underline"
          >
            Last {days} days
          </Link>
        ))}
      </div>
    </div>
  );
}
