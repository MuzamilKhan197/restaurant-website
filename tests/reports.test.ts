import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultRange,
  reportRangeSchema,
  formatMinor,
  decimalMinor,
  chartBuckets,
  csvCell,
  reportCsv,
  type SalesReport,
  type Daily,
} from '../src/features/reports/model.ts';
test('weekly chart buckets preserve partial weeks and year boundaries', () => {
  const daily: Daily[] = Array.from({ length: 40 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 11, 20 + i)).toISOString().slice(0, 10),
    orders: 1,
    completed: 0,
    sales_minor: '0',
    received_minor: '101',
    refunded_minor: '0',
  }));
  const { buckets } = chartBuckets(daily);
  assert.equal(buckets[0].date, '2026-12-20');
  assert.equal(buckets[0].end, '2026-12-20');
  assert.equal(buckets.at(-1)?.end, daily.at(-1)?.date);
  assert.equal(
    buckets.reduce((sum, b) => sum + BigInt(b.received_minor), 0n),
    4040n,
  );
});
test('CSV exports use exact decimal cash values and safe sold product names', () => {
  const report: SalesReport = {
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    from: '2026-01-01',
    to: '2026-01-01',
    summary: {
      total_orders: 0,
      pending_orders: 0,
      active_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      rejected_orders: 0,
      completed_sales_minor: '0',
      average_completed_minor: '0',
      unpaid_minor: '0',
      refund_due_minor: '0',
    },
    cash: { received_minor: '0', refunded_minor: '2500', net_minor: '-2500' },
    daily: [
      {
        date: '2026-01-01',
        orders: 0,
        completed: 0,
        sales_minor: '0',
        received_minor: '0',
        refunded_minor: '2500',
      },
    ],
    statuses: [],
    popular: [
      {
        product_id: '50000000-0000-4000-8000-000000000001',
        name: '=HYPERLINK("bad")',
        units: 1,
        orders: 1,
        sales_minor: '9007199254740993123',
      },
    ],
  };
  assert.ok(reportCsv(report, 'daily').includes('0.00,0.00,25.00,-25.00'));
  const popular = reportCsv(report, 'popular');
  assert.ok(popular.includes('90071992547409931.23'));
  assert.ok(popular.includes(String.fromCharCode(39) + '=HYPERLINK'));
});
test('report dates validate real calendar days and inclusive leap-year limits', () => {
  assert.equal(
    reportRangeSchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success,
    false,
  );
  assert.equal(reportRangeSchema.safeParse({ from: '2024-01-01', to: '2024-12-31' }).success, true);
  assert.equal(
    reportRangeSchema.safeParse({ from: '2024-01-01', to: '2025-01-01' }).success,
    false,
  );
  assert.equal(
    reportRangeSchema.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success,
    false,
  );
  assert.deepEqual(defaultRange('Asia/Karachi', new Date('2026-12-31T20:00:00Z'), 7), {
    from: '2026-12-26',
    to: '2027-01-01',
  });
});
test('minor-unit money formatting preserves cents and values larger than JS safe integers', () => {
  assert.equal(decimalMinor('9007199254740993123'), '90071992547409931.23');
  assert.equal(decimalMinor('-1'), '-0.01');
  assert.match(formatMinor('-1'), /^-.*0\.01$/);
  assert.match(formatMinor('9007199254740993123'), /90,071,992,547,409,931\.23/);
});
test('charts aggregate the entire period with exact amounts and preserve totals', () => {
  const daily: Daily[] = Array.from({ length: 130 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    orders: 1,
    completed: 1,
    sales_minor: '9007199254740993',
    received_minor: '25',
    refunded_minor: '0',
  }));
  const result = chartBuckets(daily);
  assert.equal(result.granularity, 'month');
  assert.equal(
    result.buckets.reduce((sum, b) => sum + b.orders, 0),
    130,
  );
  assert.equal(
    result.buckets.reduce((sum, b) => sum + BigInt(b.sales_minor), 0n),
    130n * 9007199254740993n,
  );
  assert.equal(result.buckets[0].date, '2026-01-01');
  assert.equal(result.buckets.at(-1)?.end, daily.at(-1)?.date);
  assert.equal(chartBuckets(daily.slice(0, 40)).granularity, 'week');
  assert.equal(chartBuckets(daily.slice(0, 7)).granularity, 'day');
});
test('CSV neutralizes spreadsheet formulas, quotes names and retains legitimate negative cash', () => {
  for (const input of ['=HYPERLINK("bad")', '  +CMD', '@SUM(A1)', '\t=1'])
    assert.equal(csvCell(input).charCodeAt(1), 39);
  assert.equal(csvCell('A "dish", name'), '"A ""dish"", name"');
  assert.equal(csvCell('-12.50'), '-12.50');
  assert.equal(csvCell(20), '20');
});
