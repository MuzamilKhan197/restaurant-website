'use client';

import { useDeferredValue, useRef, useState } from 'react';
import { Search, Leaf, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DishCard } from './dish-card';
import { EmptyState } from '@/components/shared/empty-state';
import { filterDishes, menuCategories } from '@/features/menu/utils';
import type { Dish } from '@/features/menu/types';
import { cn } from '@/lib/utils';

export function MenuBrowser({ dishes }: { dishes: readonly Dish[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All dishes');
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const results = filterDishes(dishes, { category, query: deferredQuery, vegetarianOnly });
  const reset = () => {
    setQuery('');
    setCategory('All dishes');
    setVegetarianOnly(false);
    searchRef.current?.focus();
  };
  return (
    <>
      <div className="flex flex-col justify-between gap-4 border-y py-5 lg:flex-row lg:items-center">
        <div
          role="group"
          aria-label="Filter dishes by category"
          className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0"
        >
          {menuCategories.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors',
                category === item
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:max-w-56">
          <Search
            className="absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Search dishes</span>
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find your craving…"
            className="bg-card pl-9 text-xs"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-5 text-[11px] text-muted-foreground">
        <p role="status" aria-live="polite">
          {results.length} {results.length === 1 ? 'dish' : 'dishes'} to discover
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={vegetarianOnly}
            onChange={(event) => setVegetarianOnly(event.target.checked)}
            className="size-3.5 accent-orange-700"
          />
          Vegetarian &amp; vegan only
          <Leaf className="size-3.5 text-[#63734f]" aria-hidden="true" />
        </label>
      </div>
      {results.length ? (
        <div className="grid gap-5 min-[440px]:grid-cols-2 lg:grid-cols-3" aria-label="Menu dishes">
          {results.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No dishes found"
          description="Try another category, a different search, or clear your filters."
          className="my-4"
          action={
            <Button onClick={reset} variant="outline" size="sm">
              <RotateCcw />
              Reset filters
            </Button>
          }
        />
      )}
      <div className="mt-8 rounded-xl border border-[#dce2d1] bg-[#edf0e5] p-5 text-[#47543b]">
        <h2 className="text-xs font-semibold">A note from the kitchen</h2>
        <p className="mt-2 text-xs leading-6">
          This is a sample menu. Prices are in PKR; photographs are illustrative. Dietary labels do
          not guarantee an allergen-free kitchen. Speak to staff before placing a real order.
        </p>
      </div>
    </>
  );
}
