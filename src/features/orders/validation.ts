import { z } from 'zod';
export const cartItemSchema = z.object({
  product_id: z.uuid(),
  variant_id: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(20),
  addon_ids: z
    .array(z.uuid())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const cartSchema = z.array(cartItemSchema).min(1, 'Your cart is empty.').max(30);
export const checkoutSchema = z
  .object({
    method: z.enum(['pickup', 'delivery']),
    name: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    phone: z.string().trim().min(7).max(30),
    zone_id: z.union([z.uuid(), z.literal('')]),
    address_line: z.string().trim().max(300),
    area: z.string().trim().max(100),
    city: z.string().trim().max(100),
    instructions: z.string().trim().max(500),
    notes: z.string().trim().max(1000),
  })
  .superRefine((d, ctx) => {
    if (d.method === 'delivery' && (!d.zone_id || d.address_line.length < 5 || !d.area || !d.city))
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a delivery area and enter a complete address.',
      });
  });
export const quoteSchema = z.object({
  subtotal_minor: z.number().int().nonnegative(),
  delivery_fee_minor: z.number().int().nonnegative(),
  tax_minor: z.number().int().nonnegative(),
  total_minor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type Quote = z.infer<typeof quoteSchema>;
export type CheckoutState = {
  error?: string;
  success?: string;
  reference?: string;
  token?: string;
  accountOrderId?: string;
};
export type CartItem = z.infer<typeof cartItemSchema>;
export const cashUpdateSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['paid', 'refunded']),
    previous: z.enum(['unpaid', 'refund_due']),
  })
  .refine(
    (d) => (d.status === 'paid' ? d.previous === 'unpaid' : d.previous === 'refund_due'),
    'Payment changed. Refresh and retry.',
  );
