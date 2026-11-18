'use client';
import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { createTicket } from '@/features/support/actions';
import { categories, type SupportState } from '@/features/support/validation';
import { Button } from '@/components/ui/button';
export function SupportCreateForm({
  initial,
  orderReference,
}: {
  initial: { name: string; email: string };
  orderReference: string;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({
    ...initial,
    subject: '',
    body: '',
    category: 'general',
    order_reference: orderReference,
  });
  const attempt = useRef({ digest: '', token: '' });
  const [state, action, pending] = useActionState<SupportState, FormData>(async (prev, form) => {
    form.set(
      'order_token',
      new URLSearchParams(window.location.hash.slice(1)).get('order_token') || '',
    );
    const payload = JSON.stringify(
      Object.fromEntries(
        ['name', 'email', 'subject', 'body', 'category', 'order_reference', 'order_token'].map(
          (k) => [k, form.get(k)],
        ),
      ),
    );
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))),
      (n) => n.toString(16).padStart(2, '0'),
    ).join('');
    if (attempt.current.digest !== digest) {
      attempt.current = { digest, token: '' };
    }
    try {
      attempt.current.token =
        sessionStorage.getItem('restaurant-support:' + digest) || attempt.current.token;
    } catch {}
    if (!/^[a-f0-9]{64}$/.test(attempt.current.token))
      attempt.current.token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
    try {
      sessionStorage.setItem('restaurant-support:' + digest, attempt.current.token);
    } catch {}
    form.set('token', attempt.current.token);
    try {
      return await createTicket(prev, form);
    } catch {
      return {
        error: 'Connection interrupted. Retry the same request to avoid duplicate tickets.',
      };
    }
  }, {});
  const field = (name: string, label: string, max: number, type = 'text') => (
    <label className="block text-sm" key={name}>
      {label}
      <input
        name={name}
        type={type}
        value={draft[name]}
        onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
        required={name !== 'order_reference'}
        maxLength={max}
        readOnly={name === 'email' && Boolean(initial.email)}
        className="mt-2 block w-full rounded-lg border bg-background p-3"
      />
    </label>
  );
  if (state.reference)
    return (
      <div className="rounded-2xl border bg-card p-8">
        <h2 className="font-serif text-3xl">We&apos;ve received your request.</h2>
        <p className="mt-4 break-all text-sm">{state.reference}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          {state.guest
            ? 'Save the private ticket link. Anyone with this link can access the conversation.'
            : 'Your ticket is saved in your account.'}{' '}
          You can attach evidence from the conversation.
        </p>
        <Button asChild className="mt-6">
          <Link
            href={
              state.guest
                ? '/support/' + state.reference + '#token=' + state.token
                : '/account/support/' + state.reference
            }
          >
            Open conversation
          </Link>
        </Button>
      </div>
    );
  return (
    <form action={action} className="space-y-5 rounded-2xl border bg-card p-6 sm:p-8">
      <fieldset disabled={pending} className="space-y-5">
        {field('name', 'Your name', 100)}
        {field('email', 'Email', 254, 'email')}
        {field('subject', 'Subject', 150)}
        <label className="block text-sm">
          Category
          <select
            name="category"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            className="mt-2 block w-full rounded-lg border bg-background p-3"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        {field('order_reference', 'Order reference (optional)', 50)}
        {draft.order_reference && (
          <p className="text-xs leading-6 text-muted-foreground">
            For guest orders, open support from your private order-tracking page to prove access.
            Registered customers can use an order from their account.
          </p>
        )}
        <label className="block text-sm">
          How can we help?
          <textarea
            name="body"
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            required
            maxLength={5000}
            rows={6}
            className="mt-2 block w-full rounded-lg border bg-background p-3"
          />
        </label>
        <p className="text-xs leading-6 text-muted-foreground">
          Support requests do not automatically cancel an order or change its payment status.
        </p>
        <Button type="submit">{pending ? 'Sending...' : 'Create support ticket'}</Button>
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
