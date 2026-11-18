import { z } from 'zod';

export function parsePrice(value: string) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a price with no more than two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (minor > 100000000) throw new Error('Price must not exceed 1,000,000.00.');
  return minor;
}
const money = z
  .string()
  .trim()
  .transform((value, ctx) => {
    try {
      return parsePrice(value);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message });
      return z.NEVER;
    }
  });
const id = z.uuid();
const optionalId = z.union([id, z.literal('')]).optional();
const name = z.string().trim().min(1, 'Enter a name.').max(100);
const sort = z.coerce.number().int().min(0).max(10000);
export const categorySchema = z.object({
  id: optionalId,
  name,
  slug: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use a lowercase slug with hyphens.'),
  sort_order: sort,
  is_active: z.boolean(),
});
export const productSchema = categorySchema.extend({
  category_id: id,
  description: z.string().trim().max(2000),
  price: money,
  allergens: z
    .string()
    .max(500)
    .transform((value) =>
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  dietary_labels: z.array(z.enum(['vegetarian', 'vegan', 'gluten_free', 'signature'])).max(4),
  is_available: z.boolean(),
  is_featured: z.boolean(),
});
export const variantSchema = z
  .object({
    id: optionalId,
    product_id: id,
    name: name.max(80),
    price: money,
    is_active: z.boolean(),
    is_default: z.boolean(),
    sort_order: sort,
  })
  .refine((v) => !v.is_default || v.is_active, { message: 'A default variant must be active.' });
export const groupSchema = z
  .object({
    id: optionalId,
    name,
    min_selections: z.coerce.number().int().min(0).max(20),
    max_selections: z.coerce.number().int().min(1).max(20),
    is_active: z.boolean(),
  })
  .refine((v) => v.min_selections <= v.max_selections, {
    message: 'Minimum selections cannot exceed maximum.',
  });
export const addonSchema = z.object({
  id: optionalId,
  addon_group_id: id,
  name,
  price: money.refine((v) => v <= 10000000, 'Add-on price must not exceed 100,000.00.'),
  is_available: z.boolean(),
});
export const linkSchema = z.object({ product_id: id, addon_group_id: id, sort_order: sort });
export const imageSchema = z.object({
  id: optionalId,
  product_id: id,
  alt_text: z.string().trim().min(1).max(200),
  sort_order: sort,
});
export const deleteSchema = z.object({
  entity: z.enum(['category', 'product', 'variant', 'group', 'addon', 'link', 'image']),
  id: optionalId,
  product_id: optionalId,
  addon_group_id: optionalId,
});
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export function validateImage(bytes: Uint8Array, type: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_SIZE)
    throw new Error('Choose an image smaller than 5 MiB.');
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'image/png' && png) return 'png';
  if (type === 'image/jpeg' && jpeg) return 'jpg';
  if (type === 'image/webp' && webp) return 'webp';
  throw new Error('Upload a valid JPEG, PNG or WebP image.');
}
