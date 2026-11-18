import type { Dish, MenuCategory } from './types';

export const menuCategories: readonly ('All dishes' | MenuCategory)[] = [
  'All dishes',
  'Starters',
  'Mains',
  'From the grill',
  'Desserts',
  'Drinks',
];
export function filterDishes(
  dishes: readonly Dish[],
  {
    category = 'All dishes',
    query = '',
    vegetarianOnly = false,
  }: { category?: string; query?: string; vegetarianOnly?: boolean },
) {
  const search = query.trim().toLocaleLowerCase();
  return dishes.filter(
    (dish) =>
      (category === 'All dishes' || dish.category === category) &&
      (!vegetarianOnly || dish.tags.some((tag) => tag === 'Vegetarian' || tag === 'Vegan')) &&
      `${dish.name} ${dish.description} ${dish.category} ${dish.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(search),
  );
}
export function formatPrice(value: number, currency = 'PKR') {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}
