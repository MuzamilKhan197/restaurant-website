'use client';
import { useActionState, useState } from 'react';
import { saveProfile, saveAddress, deleteAddress } from '@/features/customers/actions';
import type { CustomerState } from '@/features/customers/validation';
import { Button } from '@/components/ui/button';
const actions = { profile: saveProfile, address: saveAddress, delete: deleteAddress };
export function AccountForm({
  kind,
  initial = {},
  disabled = false,
}: {
  kind: keyof typeof actions;
  initial?: Record<string, string | boolean>;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<CustomerState, FormData>(actions[kind], {});
  const [draft, setDraft] = useState(initial);
  const fields =
    kind === 'profile'
      ? [
          ['name', 'Full name', 100],
          ['phone', 'Phone (optional)', 30],
        ]
      : kind === 'address'
        ? [
            ['label', 'Label, e.g. Home', 60],
            ['address_line', 'Street address', 300],
            ['area', 'Area', 100],
            ['city', 'City', 100],
            ['instructions', 'Delivery instructions (optional)', 500],
          ]
        : [];
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={pending || disabled} className="space-y-4">
        {typeof initial.id === 'string' && <input type="hidden" name="id" value={initial.id} />}
        {fields.map(([name, label, max]) => (
          <label key={name} className="block text-sm">
            {label}
            <input
              name={String(name)}
              value={String(draft[name] || '')}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [name]: event.target.value }))
              }
              maxLength={Number(max)}
              minLength={name === 'address_line' ? 5 : undefined}
              required={!['phone', 'instructions'].includes(String(name))}
              autoComplete={
                name === 'name'
                  ? 'name'
                  : name === 'phone'
                    ? 'tel'
                    : name === 'address_line'
                      ? 'street-address'
                      : undefined
              }
              className="mt-2 block w-full rounded-lg border bg-background p-3"
            />
          </label>
        ))}
        {kind === 'address' && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_default"
              checked={Boolean(draft.is_default)}
              onChange={(event) =>
                setDraft((current) => ({ ...current, is_default: event.target.checked }))
              }
            />
            Default address
          </label>
        )}
        <Button size="sm" variant={kind === 'delete' ? 'outline' : 'default'} type="submit">
          {pending ? 'Saving…' : kind === 'delete' ? 'Delete address' : 'Save changes'}
        </Button>
      </fieldset>
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
