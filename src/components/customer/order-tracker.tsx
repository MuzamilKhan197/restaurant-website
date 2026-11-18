'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { getTrackedOrder } from '@/features/orders/actions';
import { formatPrice } from '@/features/menu/utils';
const orderSchema = z.object({
  reference: z.string(),
  status: z.string(),
  method: z.string(),
  currency: z.string(),
  total_minor: z.number(),
  subtotal_minor: z.number(),
  delivery_fee_minor: z.number(),
  tax_minor: z.number(),
  reason: z.string().nullable(),
  payment_status: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      variant: z.string().nullable(),
      quantity: z.number(),
      total_minor: z.number(),
      addons: z.array(
        z.object({ name: z.string(), quantity: z.number(), price_minor: z.number() }),
      ),
    }),
  ),
  events: z.array(z.object({ status: z.string(), created_at: z.string() })),
});
export function OrderTracker({ reference }: { reference: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<z.infer<typeof orderSchema> | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true,
      inFlight = false;
    async function refresh() {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
        const result = await getTrackedOrder(reference, token);
        if (!active) return;
        const parsed = orderSchema.safeParse(result.order);
        if (parsed.success) {
          setOrder(parsed.data);
          setError('');
        } else setError(result.error || 'Unable to read your order.');
      } catch {
        if (active) setError('Connection interrupted. Retrying shortly.');
      } finally {
        inFlight = false;
        if (active) setBusy(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [reference]);
  if (!order)
    return (
      <div role={error ? 'alert' : 'status'} className="rounded-xl border bg-card p-8 text-center">
        {busy ? 'Loading your private order…' : error || 'Order unavailable.'}
      </div>
    );
  const price = (v: number) => formatPrice(v / 100, order.currency);
  return (
    <>
      <p className="eyebrow">From our kitchen to you</p>
      <h1 className="mt-4 font-serif text-4xl">Your order is {order.status}.</h1>
      <p className="mt-4 break-all text-sm">{order.reference}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Updates refresh every 15 seconds while this page is visible. Keep this private link safe.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {order.reason && <p className="mt-5 rounded-lg bg-secondary p-4 text-sm">{order.reason}</p>}
      <div className="mt-8 space-y-4">
        {order.items.map((item, index) => (
          <article key={index} className="rounded-xl border bg-card p-5">
            <div className="flex justify-between gap-3">
              <h2 className="font-semibold">
                {item.quantity} × {item.name}
                {item.variant ? ' · ' + item.variant : ''}
              </h2>
              <p>{price(item.total_minor)}</p>
            </div>
            {item.addons.map((a, i) => (
              <p key={i} className="mt-2 text-xs text-muted-foreground">
                {a.quantity} × {a.name} (+{price(a.price_minor)} each per dish)
              </p>
            ))}
          </article>
        ))}
      </div>
      <dl className="mt-6 space-y-2 rounded-xl border p-5">
        {[
          ['Subtotal', order.subtotal_minor],
          ['Delivery', order.delivery_fee_minor],
          ['Tax', order.tax_minor],
          ['Total', order.total_minor],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <dt>{label}</dt>
            <dd>{price(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm capitalize">
        {order.method === 'delivery' ? 'Cash on delivery' : 'Pay at pickup'} ·{' '}
        {order.payment_status}
      </p>
      <button
        className="mt-6 text-sm underline"
        onClick={() => {
          const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
          router.push(
            '/support/new?order=' +
              encodeURIComponent(reference) +
              '#order_token=' +
              encodeURIComponent(token),
          );
        }}
      >
        Get help with this order
      </button>
      <ol className="mt-8 space-y-4">
        {order.events.map((e, i) => (
          <li key={i} className="border-l-2 pl-4 text-sm">
            <span className="capitalize">{e.status}</span>
            <time dateTime={e.created_at} className="ml-3 text-xs text-muted-foreground">
              {new Date(e.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
            </time>
          </li>
        ))}
      </ol>
    </>
  );
}
