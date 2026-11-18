'use client';
import { useActionState, useState } from 'react';
import { updateOrder, recordCash } from '@/features/orders/actions';
import type { CheckoutState } from '@/features/orders/validation';
import { Button } from '@/components/ui/button';
const next: Record<string, string[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
};
export function OrderForm({
  id,
  status,
  payment = false,
  orderStatus,
}: {
  id: string;
  status: string;
  payment?: boolean;
  orderStatus?: string;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(
    payment ? recordCash : updateOrder,
    {},
  );
  const choices = payment
    ? status === 'unpaid' && !['rejected', 'cancelled'].includes(orderStatus || '')
      ? ['paid']
      : status === 'refund_due'
        ? ['refunded']
        : []
    : next[status] || [];
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState(choices[0] || '');
  if (!choices.length) return null;
  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-5">
      <input name="id" type="hidden" value={id} />
      <input name="previous" type="hidden" value={status} />
      <label className="block text-sm">
        {payment ? 'Cash payment' : 'Update order'}
        <select
          name="status"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending}
          className="mt-2 block w-full rounded-lg border bg-background p-3"
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {payment
                ? choice === 'paid'
                  ? 'Confirm cash received'
                  : 'Confirm cash refunded'
                : choice}
            </option>
          ))}
        </select>
      </label>
      {!payment && (
        <label className="block text-sm">
          Reason (required to reject or cancel)
          <textarea
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            disabled={pending}
            className="mt-2 block w-full rounded-lg border bg-background p-3"
          />
        </label>
      )}
      <Button size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save update'}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
