import { z } from 'zod';
export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(100),
  phone: z.string().trim().max(30),
});
export const addressSchema = z.object({
  id: z.union([z.uuid(), z.literal('')]).optional(),
  label: z.string().trim().min(1).max(60),
  address_line: z.string().trim().min(5).max(300),
  area: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  instructions: z.string().trim().max(500),
  is_default: z.boolean(),
});
export type CustomerState = { error?: string; success?: string };
