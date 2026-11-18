export type MenuCategory = string;
export type DietaryLabel = 'Vegetarian' | 'Vegan' | 'Gluten-free' | 'Signature';
export type DishVariant = { id: string; name: string; price_minor: number; is_default: boolean };
export type DishAddonGroup = {
  id: string;
  name: string;
  min_selections: number;
  max_selections: number;
  addons: { id: string; name: string; price_minor: number; is_available: boolean }[];
};
export interface Dish {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description: string;
  image: string;
  imageUrl?: string;
  imageAlt?: string;
  currency?: string;
  fromPrice?: boolean;
  tags: DietaryLabel[];
  allergens: string;
  featured?: boolean;
  available: boolean;
  selection?: {
    productId: string;
    basePrice: number;
    ordering: boolean;
    variants: DishVariant[];
    groups: DishAddonGroup[];
  };
}
