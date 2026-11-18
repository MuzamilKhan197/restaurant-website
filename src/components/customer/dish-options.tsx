'use client';
import { useState } from 'react';
import { formatPrice } from '@/features/menu/utils';
import { addToCart } from '@/features/orders/cart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
type Variant = { id: string; name: string; price_minor: number; is_default: boolean };
type Group = {
  id: string;
  name: string;
  min_selections: number;
  max_selections: number;
  addons: { id: string; name: string; price_minor: number; is_available: boolean }[];
};
export function DishOptions({
  basePrice,
  currency,
  variants,
  groups,
  available,
  productId,
  name,
  ordering,
}: {
  basePrice: number;
  currency: string;
  variants: Variant[];
  groups: Group[];
  available: boolean;
  productId: string;
  name: string;
  ordering: boolean;
}) {
  const [variant, setVariant] = useState(
    variants.find((v) => v.is_default)?.id || variants[0]?.id || '',
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const total =
    (variants.find((v) => v.id === variant)?.price_minor ?? basePrice) +
    groups
      .flatMap((g) => g.addons)
      .filter((a) => selected.includes(a.id))
      .reduce((sum, a) => sum + a.price_minor, 0);
  return (
    <div className="mt-7 space-y-6">
      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Choose a size</legend>
          {variants.map((v) => (
            <label
              key={v.id}
              className="mb-2 flex items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <input
                type="radio"
                name="variant"
                checked={variant === v.id}
                onChange={() => setVariant(v.id)}
              />
              <span className="flex-1">{v.name}</span>
              {formatPrice(v.price_minor / 100, currency)}
            </label>
          ))}
        </fieldset>
      )}
      {groups.map((g) => (
        <fieldset key={g.id}>
          <legend className="mb-3 text-sm font-semibold">
            {g.name}{' '}
            <span className="font-normal text-muted-foreground">
              (choose {g.min_selections}–{g.max_selections})
            </span>
          </legend>
          {g.addons.map((a) => (
            <label key={a.id} className="mb-2 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(a.id)}
                disabled={
                  !a.is_available ||
                  (!selected.includes(a.id) &&
                    g.addons.filter((x) => selected.includes(x.id)).length >= g.max_selections)
                }
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked ? [...current, a.id] : current.filter((id) => id !== a.id),
                  )
                }
              />
              <span className="flex-1">
                {a.name}
                {!a.is_available && ' (unavailable)'}
              </span>
              +{formatPrice(a.price_minor / 100, currency)}
            </label>
          ))}
        </fieldset>
      ))}
      <p className="text-2xl font-semibold">{formatPrice(total / 100, currency)}</p>
      <Button
        type="button"
        disabled={
          !available ||
          !ordering ||
          groups.some(
            (g) => g.addons.filter((a) => selected.includes(a.id)).length < g.min_selections,
          )
        }
        onClick={() => {
          try {
            addToCart({
              product_id: productId,
              variant_id: variant || null,
              quantity: 1,
              addon_ids: selected,
              name,
              variant_name: variants.find((v) => v.id === variant)?.name || '',
              extras: groups
                .flatMap((g) => g.addons)
                .filter((a) => selected.includes(a.id))
                .map((a) => a.name),
              unit_estimate: total,
              currency,
            });
            setFeedback('Added to your cart.');
          } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Unable to save your cart.');
          }
        }}
      >
        Add to cart
      </Button>
      <Link href="/cart" className="ml-4 text-sm underline">
        View cart
      </Link>
      <p role="status" className="rounded-xl bg-secondary p-4 text-sm">
        {feedback ||
          (!available
            ? 'This dish is currently unavailable.'
            : !ordering
              ? 'Online orders are currently paused.'
              : 'Choose your size and extras, then add to your cart.')}
      </p>
    </div>
  );
}
