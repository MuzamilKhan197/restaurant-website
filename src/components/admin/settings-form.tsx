'use client';
import { startTransition, useActionState } from 'react';
import { saveBusiness, saveWebsite, saveZone } from '@/features/settings/actions';
import type { SettingsResult } from '@/features/settings/model';
import { Button } from '@/components/ui/button';

const actions = { business: saveBusiness, website: saveWebsite, zone: saveZone };
export function SettingsForm({
  kind,
  children,
  label,
  disabled = false,
}: {
  kind: keyof typeof actions;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(actions[kind], {});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(() => action(form));
      }}
      className="rounded-xl border bg-card p-5"
    >
      <fieldset disabled={pending || disabled} className="space-y-4">
        {children}
        {!disabled && <Button disabled={pending}>{pending ? 'Saving…' : label}</Button>}
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
