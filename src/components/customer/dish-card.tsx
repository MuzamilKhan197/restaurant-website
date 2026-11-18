import Image from 'next/image';
import { UtensilsCrossed } from 'lucide-react';
import { DishOptions } from './dish-options';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/features/menu/utils';
import type { Dish } from '@/features/menu/types';

export function DishCard({ dish }: { dish: Dish }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg hover:shadow-foreground/5">
      <div className="relative block aspect-[1.35] overflow-hidden">
        {dish.imageUrl || dish.image ? (
          <Image
            src={dish.imageUrl || `/assets/${dish.image}.jpg`}
            unoptimized={Boolean(dish.imageUrl)}
            alt={dish.imageAlt || dish.name}
            fill
            sizes="(max-width: 440px) 90vw, (max-width: 768px) 45vw, (max-width: 1100px) 30vw, 280px"
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary">
            <UtensilsCrossed className="size-12 text-muted-foreground" />
          </div>
        )}
        <span className="absolute left-3 top-3">
          <Badge
            variant={dish.tags.includes('Signature') ? 'default' : 'secondary'}
            className="border-0 bg-card/95 text-foreground"
          >
            {dish.tags.includes('Signature')
              ? 'Signature dish'
              : dish.tags.includes('Vegan')
                ? 'Plant-powered'
                : dish.tags.includes('Vegetarian')
                  ? 'Vegetarian'
                  : dish.category}
          </Badge>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="eyebrow text-[8px]">{dish.category}</p>
        <h3 className="mt-2 font-serif text-[22px] leading-snug tracking-tight">{dish.name}</h3>
        <p className="mt-2 flex-1 text-xs leading-6 text-muted-foreground">{dish.description}</p>
        <p className="mt-3 text-[10px] text-muted-foreground">Allergens: {dish.allergens}</p>
        {!dish.available && (
          <p className="mt-2 text-xs font-semibold text-brand-strong">Currently unavailable</p>
        )}
        {dish.selection ? (
          <DishOptions
            {...dish.selection}
            name={dish.name}
            available={dish.available}
            currency={dish.currency || 'PKR'}
            compact
          />
        ) : (
          <div className="mt-4 border-t pt-4">
            <span className="text-sm font-semibold">
              {dish.fromPrice && 'From '}
              {formatPrice(dish.price, dish.currency)}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
