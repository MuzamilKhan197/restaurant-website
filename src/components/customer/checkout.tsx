'use client';
import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { useCart, setCartQuantity, clearCart } from '@/features/orders/cart';
import { quoteCheckout, placeCheckout } from '@/features/orders/actions';
import type { Quote, CheckoutState } from '@/features/orders/validation';
import { formatPrice } from '@/features/menu/utils';
import { Button } from '@/components/ui/button';
type Address = {
  id: string;
  label: string;
  address_line: string;
  area: string;
  city: string;
  instructions: string | null;
};
export function Checkout({
  zones,
  available,
  deliveryEnabled,
  initial,
  addresses,
}: {
  zones: { id: string; name: string }[];
  available: boolean;
  deliveryEnabled: boolean;
  initial: { name: string; email: string; phone: string };
  addresses: Address[];
}) {
  const cart = useCart(),
    [method, setMethod] = useState('pickup'),
    [zone, setZone] = useState(''),
    [quote, setQuote] = useState<{ value: Quote; signature: string } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [selectedAddress, setSelectedAddress] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({
    ...initial,
    address_line: '',
    area: '',
    city: '',
    instructions: '',
    notes: '',
  });
  const token = useRef(''),
    fingerprint = useRef(''),
    signature = JSON.stringify([cart, method, zone]);
  const currentQuote = quote?.signature === signature ? quote.value : null;
  const [state, action, pending] = useActionState<CheckoutState, FormData>(async (prev, form) => {
    form.set('items', JSON.stringify(cart));
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(
            JSON.stringify(
              Object.fromEntries(
                [
                  'method',
                  'name',
                  'email',
                  'phone',
                  'zone_id',
                  'address_line',
                  'area',
                  'city',
                  'instructions',
                  'notes',
                  'expected_total',
                  'items',
                ].map((key) => [key, form.get(key)]),
              ),
            ),
          ),
        ),
      ),
      (n) => n.toString(16).padStart(2, '0'),
    ).join('');
    const attemptKey = 'restaurant-checkout:' + digest;
    if (fingerprint.current !== digest) {
      token.current = '';
      fingerprint.current = digest;
    }
    try {
      const saved = sessionStorage.getItem(attemptKey);
      if (saved && /^[a-f0-9]{64}$/.test(saved)) token.current = saved;
    } catch {}
    if (!token.current)
      token.current = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
    try {
      sessionStorage.setItem(attemptKey, token.current);
    } catch {}
    form.set('token', token.current);
    try {
      const result = await placeCheckout(prev, form);
      if (result.reference) {
        try {
          clearCart();
        } catch {}
      }
      return result;
    } catch {
      return {
        error: 'Connection interrupted. Retry the same checkout to avoid duplicate orders.',
      };
    }
  }, {});
  async function review() {
    setBusy(true);
    setError('');
    try {
      const result = await quoteCheckout(cart, method, zone);
      if (result.quote) setQuote({ value: result.quote, signature });
      else setError(result.error || 'Unable to calculate your total.');
    } catch {
      setError('Unable to calculate your total. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  if (state.reference && state.token)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center">
        <h1 className="font-serif text-4xl">Thank you. Your order is in.</h1>
        <p className="mt-5 break-all text-sm">{state.reference}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          {state.accountOrderId
            ? 'Your order is pending restaurant acceptance. Follow updates in your account.'
            : 'Your order is pending restaurant acceptance. Save your private tracking link; anyone with it can view this order.'}
        </p>
        <Button asChild className="mt-6">
          <Link
            href={
              state.accountOrderId
                ? '/account/orders/' + state.accountOrderId
                : '/track/' + state.reference + '#token=' + state.token
            }
          >
            Track your order
          </Link>
        </Button>
      </div>
    );
  if (!cart.length)
    return (
      <div className="py-12 text-center">
        <h1 className="font-serif text-4xl">Your table is waiting.</h1>
        <p className="mt-4 text-sm text-muted-foreground">Add a dish to get started.</p>
        <Link className="mt-6 inline-block underline" href="/menu">
          Explore the menu
        </Link>
      </div>
    );
  const address = addresses.find((a) => a.id === selectedAddress);
  return (
    <>
      <h1 className="font-serif text-4xl">Your order</h1>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {cart.map((item, index) => (
            <article
              key={JSON.stringify([item.product_id, item.variant_id, item.addon_ids])}
              className="rounded-xl border bg-card p-5"
            >
              <h2 className="font-semibold">
                {item.name}
                {item.variant_name ? ' · ' + item.variant_name : ''}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">{item.extras.join(', ')}</p>
              <p className="mt-3 text-sm">
                Estimated {formatPrice((item.quantity * item.unit_estimate) / 100, item.currency)}
              </p>
              <div className="mt-3 flex items-center gap-4">
                <label className="text-sm">
                  Quantity{' '}
                  <input
                    type="number"
                    className="ml-2 w-20 rounded-lg border p-2"
                    min={1}
                    max={20}
                    value={item.quantity}
                    onChange={(e) => {
                      setCartQuantity(index, Number(e.target.value));
                      token.current = '';
                    }}
                  />
                </label>
                <button
                  className="text-xs underline"
                  onClick={() => {
                    setCartQuantity(index, 0);
                    token.current = '';
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
          <p className="text-xs leading-6 text-muted-foreground">
            Final prices, availability, delivery and tax are checked by the restaurant before
            placing your order.
          </p>
        </div>
        <form action={action} className="space-y-5 rounded-xl border bg-card p-6">
          <fieldset disabled={pending || !available} className="space-y-5">
            <legend className="mb-5 font-semibold">Checkout as guest or with your account</legend>
            <label className="block text-sm">
              Order type
              <select
                name="method"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  token.current = '';
                }}
                className="mt-2 block w-full rounded-lg border bg-background p-3"
              >
                <option value="pickup">Pickup · Pay at pickup</option>
                {deliveryEnabled && <option value="delivery">Delivery · Cash on delivery</option>}
              </select>
            </label>
            {[
              ['name', 'Full name', initial.name, 100],
              ['email', 'Email', initial.email, 254],
              ['phone', 'Phone', initial.phone, 30],
            ].map(([name, label, , max]) => (
              <label key={name} className="block text-sm">
                {label}
                <input
                  name={String(name)}
                  type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
                  value={draft[String(name)] || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [String(name)]: e.target.value }))}
                  required
                  maxLength={Number(max)}
                  className="mt-2 block w-full rounded-lg border bg-background p-3"
                />
              </label>
            ))}
            {method === 'delivery' ? (
              <>
                <label className="block text-sm">
                  Delivery area
                  <select
                    name="zone_id"
                    required
                    value={zone}
                    onChange={(e) => {
                      setZone(e.target.value);
                      token.current = '';
                    }}
                    className="mt-2 block w-full rounded-lg border bg-background p-3"
                  >
                    <option value="">Choose area</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>
                {addresses.length > 0 && (
                  <label className="block text-sm">
                    Saved address
                    <select
                      value={selectedAddress}
                      onChange={(e) => {
                        setSelectedAddress(e.target.value);
                        const a = addresses.find((a) => a.id === e.target.value);
                        setDraft((d) => ({
                          ...d,
                          address_line: a?.address_line || '',
                          area: a?.area || '',
                          city: a?.city || '',
                          instructions: a?.instructions || '',
                        }));
                      }}
                      className="mt-2 block w-full rounded-lg border bg-background p-3"
                    >
                      <option value="">Enter a new address</option>
                      {addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div key={selectedAddress} className="space-y-4">
                  {[
                    ['address_line', 'Street address', address?.address_line || '', 300],
                    ['area', 'Area', address?.area || '', 100],
                    ['city', 'City', address?.city || '', 100],
                    [
                      'instructions',
                      'Delivery instructions (optional)',
                      address?.instructions || '',
                      500,
                    ],
                  ].map(([name, label, , max]) => (
                    <label key={name} className="block text-sm">
                      {label}
                      <input
                        name={String(name)}
                        value={draft[String(name)] || ''}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [String(name)]: e.target.value }))
                        }
                        required={name !== 'instructions'}
                        maxLength={Number(max)}
                        className="mt-2 block w-full rounded-lg border bg-background p-3"
                      />
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                {['zone_id', 'address_line', 'area', 'city', 'instructions'].map((name) => (
                  <input key={name} name={name} type="hidden" value="" />
                ))}
              </>
            )}
            <label className="block text-sm">
              Order notes (optional)
              <textarea
                name="notes"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                maxLength={1000}
                className="mt-2 block w-full rounded-lg border bg-background p-3"
              />
            </label>
            <Button type="button" variant="outline" onClick={review} disabled={busy}>
              {busy ? 'Checking…' : 'Review final total'}
            </Button>
            {currentQuote && (
              <>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Subtotal', currentQuote.subtotal_minor],
                    ['Delivery', currentQuote.delivery_fee_minor],
                    ['Tax', currentQuote.tax_minor],
                    ['Total', currentQuote.total_minor],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt>{label}</dt>
                      <dd>{formatPrice(Number(value) / 100, currentQuote.currency)}</dd>
                    </div>
                  ))}
                </dl>
                <input type="hidden" name="expected_total" value={currentQuote.total_minor} />
                <p className="text-xs text-muted-foreground">
                  Cash payment only. Your order needs restaurant acceptance.
                </p>
                <Button type="submit" className="w-full">
                  {pending ? 'Placing your order…' : 'Place order'}
                </Button>
              </>
            )}
          </fieldset>
          {!available && (
            <p role="status" className="text-sm">
              Online ordering is currently paused. Your cart is saved.
            </p>
          )}
          {(error || state.error) && (
            <p role="alert" className="text-sm text-red-700">
              {error || state.error}
            </p>
          )}
        </form>
      </div>
    </>
  );
}
