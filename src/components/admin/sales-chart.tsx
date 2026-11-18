'use client';
import { useState } from 'react';
import { chartBuckets, formatMinor, type Daily } from '@/features/reports/model';
const metrics = {
  sales_minor: 'Completed sales',
  received_minor: 'Cash received',
  refunded_minor: 'Cash refunded',
  orders: 'Order count',
} as const;
export function SalesChart({ daily, currency }: { daily: Daily[]; currency: string }) {
  const [metric, setMetric] = useState<keyof typeof metrics>('sales_minor'),
    [selected, setSelected] = useState<number | null>(null),
    { granularity, buckets } = chartBuckets(daily);
  const amounts = buckets.map((b) => BigInt(b[metric])),
    maximum = amounts.reduce((max, n) => (n > max ? n : max), 0n);
  const value = (n: bigint) =>
    metric === 'orders' ? n.toLocaleString('en-PK') : formatMinor(n, currency);
  const chosen = selected === null ? null : buckets[selected];
  return (
    <section aria-label="Sales and cash chart" className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Sales and cash activity</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly'} totals
            for the entire selected period.
          </p>
        </div>
        <label className="text-xs">
          Show
          <select
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as keyof typeof metrics);
              setSelected(null);
            }}
            className="ml-3 rounded-lg border bg-background p-2"
          >
            {Object.entries(metrics).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {maximum === 0n ? (
        <p className="mt-6 flex h-52 items-center justify-center rounded-lg bg-secondary text-center text-sm text-muted-foreground">
          No {metrics[metric].toLowerCase()} in this period.
        </p>
      ) : (
        <>
          <p className="mt-6 text-xs text-muted-foreground">
            Peak {granularity}: {value(maximum)}
          </p>
          <div
            className="mt-4 flex h-56 items-end gap-1 border-b"
            role="group"
            aria-label={metrics[metric] + ' by ' + granularity}
          >
            {buckets.map((bucket, index) => {
              const amount = amounts[index],
                height = Number((amount * 10000n) / maximum) / 100,
                label =
                  bucket.date +
                  (bucket.date !== bucket.end ? ' to ' + bucket.end : '') +
                  ': ' +
                  value(amount);
              return (
                <button
                  key={bucket.date}
                  type="button"
                  aria-label={label}
                  title={label}
                  onMouseEnter={() => setSelected(index)}
                  onFocus={() => setSelected(index)}
                  onClick={() => setSelected(index)}
                  className={
                    'min-w-0 flex-1 rounded-t-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
                    (index === selected ? 'bg-primary' : 'bg-blue-400 hover:bg-primary')
                  }
                  style={{ height: height + '%', minHeight: amount > 0n ? '2px' : '0' }}
                />
              );
            })}
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
            <span>{buckets[0]?.date}</span>
            <span>{buckets.at(-1)?.end}</span>
          </div>
        </>
      )}
      <p aria-live="polite" className="mt-4 min-h-5 text-xs text-muted-foreground">
        {chosen
          ? chosen.date +
            (chosen.date !== chosen.end ? ' to ' + chosen.end : '') +
            ' · ' +
            value(BigInt(chosen[metric]))
          : 'Focus or hover a bar to inspect exact values. Daily values are available in the table and CSV.'}
      </p>
    </section>
  );
}
