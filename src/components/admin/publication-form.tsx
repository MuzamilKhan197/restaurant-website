'use client';
import { useActionState } from 'react';
import { setCatalogPublication } from '@/features/storefront/actions';
import type { CustomerState } from '@/features/customers/validation';
import { Button } from '@/components/ui/button';
export function PublicationForm({ published }: { published: boolean }) {
  const [state, action, pending] = useActionState<CustomerState, FormData>(
    setCatalogPublication,
    {},
  );
  return (
    <form action={action} className="mt-5 space-y-3 rounded-xl border bg-card p-5">
      <p className="text-sm font-semibold">
        {published ? 'Restaurant is published' : 'Restaurant is a private draft'}
      </p>
      <p className="text-xs leading-6 text-muted-foreground">
        Publishing makes active dishes visible to visitors. Review your menu and business details
        first. Ordering mode is controlled separately.
      </p>
      <input name="published" value={String(!published)} type="hidden" />
      <Button disabled={pending} size="sm" variant="outline">
        {pending ? 'Saving…' : published ? 'Unpublish restaurant' : 'Publish restaurant'}
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
