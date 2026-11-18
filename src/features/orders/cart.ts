'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { cartItemSchema } from './validation';
export const storedItemSchema = cartItemSchema.extend({
  name: z.string().max(100),
  variant_name: z.string().max(80),
  extras: z.array(z.string().max(100)).max(100),
  unit_estimate: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type StoredItem = z.infer<typeof storedItemSchema>;
const key = 'restaurant-cart-v1';
function snapshot() {
  try {
    return localStorage.getItem(key) || '[]';
  } catch {
    return '[]';
  }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('restaurant-cart', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('restaurant-cart', callback);
  };
}
function parse(raw: string) {
  try {
    const parsed = z.array(storedItemSchema).max(30).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
function write(items: StoredItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event('restaurant-cart'));
}
export function useCart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '[]');
  return useMemo(() => parse(raw), [raw]);
}
export function addToCart(item: StoredItem) {
  const cart = parse(snapshot()),
    signature = (i: StoredItem) =>
      JSON.stringify([i.product_id, i.variant_id, [...i.addon_ids].sort()]);
  const index = cart.findIndex((i) => signature(i) === signature(item));
  if (index >= 0) {
    if (cart[index].quantity + item.quantity > 20)
      throw new Error('Maximum 20 of the same selection.');
    cart[index].quantity += item.quantity;
  } else {
    if (cart.length >= 30) throw new Error('Your cart can hold up to 30 selections.');
    cart.push(item);
  }
  write(cart);
}
export function setCartQuantity(index: number, quantity: number) {
  const cart = parse(snapshot());
  if (quantity === 0) cart.splice(index, 1);
  else if (cart[index] && Number.isInteger(quantity) && quantity >= 1 && quantity <= 20)
    cart[index].quantity = quantity;
  write(cart);
}
export function clearCart() {
  write([]);
}
