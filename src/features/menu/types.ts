export type MenuCategory = string;
export type DietaryLabel = 'Vegetarian' | 'Vegan' | 'Gluten-free' | 'Signature';
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
}
