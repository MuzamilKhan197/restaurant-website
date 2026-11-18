import { z } from 'zod';
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const money = z
  .string()
  .regex(/^-?\d+$/)
  .max(40);
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a valid calendar date.');
export const reportRangeSchema = z
  .object({ from: dateString, to: dateString })
  .superRefine((range, ctx) => {
    if (
      range.from < '2000-01-01' ||
      range.to > '2100-12-31' ||
      range.from > range.to ||
      (Date.parse(range.to) - Date.parse(range.from)) / 86400000 > 365
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a date range of up to 366 days, with the start before the end.',
      });
  });
export const dailySchema = z.object({
  date: dateString,
  orders: count,
  completed: count,
  sales_minor: money,
  received_minor: money,
  refunded_minor: money,
});
export const salesReportSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string(),
  from: dateString,
  to: dateString,
  summary: z.object({
    total_orders: count,
    pending_orders: count,
    active_orders: count,
    completed_orders: count,
    cancelled_orders: count,
    rejected_orders: count,
    completed_sales_minor: money,
    average_completed_minor: money,
    unpaid_minor: money,
    refund_due_minor: money,
  }),
  cash: z.object({ received_minor: money, refunded_minor: money, net_minor: money }),
  daily: z.array(dailySchema).max(366),
  popular: z
    .array(
      z.object({
        product_id: z.uuid(),
        name: z.string(),
        units: count,
        orders: count,
        sales_minor: money,
      }),
    )
    .max(10),
  statuses: z.array(z.object({ status: z.string(), count })),
});
export const activitySchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.uuid(),
        action: z.string(),
        entity_type: z.string(),
        entity_id: z.string().nullable(),
        actor_user_id: z.uuid().nullable(),
        actor_name: z.string(),
        created_at: z.string(),
      }),
    )
    .max(50),
  count,
  page: count,
  timezone: z.string(),
});
export type SalesReport = z.infer<typeof salesReportSchema>;
export type Daily = z.infer<typeof dailySchema>;
export function addDays(date: string, days: number) {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function defaultRange(timezone: string, now = new Date(), days = 30) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (key: string) => parts.find((p) => p.type === key)!.value;
  const to = value('year') + '-' + value('month') + '-' + value('day');
  return { from: addDays(to, -days + 1), to };
}
export function decimalMinor(value: string | bigint) {
  const amount = BigInt(value),
    absolute = amount < 0n ? -amount : amount;
  return (
    (amount < 0n ? '-' : '') +
    (absolute / 100n).toString() +
    '.' +
    (absolute % 100n).toString().padStart(2, '0')
  );
}
export function formatMinor(value: string | bigint, currency = 'PKR') {
  const amount = BigInt(value),
    absolute = amount < 0n ? -amount : amount;
  const text = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(absolute / 100n)
    .map((part) =>
      part.type === 'fraction' ? (absolute % 100n).toString().padStart(2, '0') : part.value,
    )
    .join('');
  return (amount < 0n ? '-' : '') + text;
}
export function chartBuckets(daily: Daily[]) {
  const granularity = daily.length > 120 ? 'month' : daily.length > 31 ? 'week' : 'day',
    groups = new Map<string, Daily & { end: string }>();
  for (const day of daily) {
    let key = day.date;
    if (granularity === 'month') key = key.slice(0, 7);
    if (granularity === 'week') {
      const d = new Date(key + 'T00:00:00Z');
      key = addDays(key, -((d.getUTCDay() + 6) % 7));
    }
    const existing = groups.get(key);
    if (!existing) groups.set(key, { ...day, end: day.date });
    else {
      existing.end = day.date;
      existing.orders += day.orders;
      existing.completed += day.completed;
      for (const metric of ['sales_minor', 'received_minor', 'refunded_minor'] as const)
        existing[metric] = (BigInt(existing[metric]) + BigInt(day[metric])).toString();
    }
  }
  return { granularity, buckets: [...groups.values()] };
}
export function csvCell(value: string | number) {
  if (typeof value === 'number') return String(value);
  if (/^-?\d+[.]\d{2}$/.test(value)) return value;
  const safe = /^\s*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function reportCsv(report: SalesReport, type: 'daily' | 'popular') {
  const rows: (string | number)[][] =
    type === 'daily'
      ? [
          [
            'Date (' + report.timezone + ')',
            'Orders',
            'Completed orders',
            'Completed sales',
            'Cash received',
            'Cash refunded',
            'Net cash',
            'Currency',
          ],
          ...report.daily.map((d) => [
            d.date,
            d.orders,
            d.completed,
            decimalMinor(d.sales_minor),
            decimalMinor(d.received_minor),
            decimalMinor(d.refunded_minor),
            decimalMinor(BigInt(d.received_minor) - BigInt(d.refunded_minor)),
            report.currency,
          ]),
        ]
      : [
          [
            'Product ID',
            'Latest sold name',
            'Units',
            'Completed orders',
            'Item sales (includes extras)',
            'Currency',
          ],
          ...report.popular.map((p) => [
            p.product_id,
            p.name,
            p.units,
            p.orders,
            decimalMinor(p.sales_minor),
            report.currency,
          ]),
        ];
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export const entityNames: Record<string, string> = {
  products: 'Dish',
  categories: 'Category',
  product_variants: 'Dish size',
  product_images: 'Menu photo',
  addon_groups: 'Extra group',
  addons: 'Extra',
  product_addon_groups: 'Dish extras',
  orders: 'Order',
  payments: 'Cash payment',
  restaurants: 'Restaurant',
  restaurant_settings: 'Restaurant settings',
  restaurant_customers: 'Customer profile',
  staff_memberships: 'Staff access',
  staff_invitations: 'Staff invitation',
  roles: 'Role',
  role_permissions: 'Role permissions',
  support_tickets: 'Support ticket',
  support_messages: 'Support message',
  support_attachments: 'Support attachment',
  delivery_zones: 'Delivery area',
};
