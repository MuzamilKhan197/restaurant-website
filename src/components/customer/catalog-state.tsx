import { UtensilsCrossed } from 'lucide-react';
export function CatalogState({ state, message }: { state: string; message?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border bg-card px-6 py-12 text-center">
      <UtensilsCrossed className="mx-auto size-8 text-brand-strong" />
      <h2 className="mt-5 font-serif text-3xl">
        {state === 'maintenance'
          ? 'We’ll be back soon.'
          : state === 'draft'
            ? 'Something good is on its way.'
            : state === 'ready'
              ? 'The kitchen is preparing the menu.'
              : 'Our menu is temporarily unavailable.'}
      </h2>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        {message ||
          (state === 'draft'
            ? 'The restaurant is getting its menu ready. Please check back soon.'
            : state === 'ready'
              ? 'New dishes will appear here as the restaurant adds them.'
              : 'Please try again later or contact the restaurant.')}
      </p>
    </div>
  );
}
