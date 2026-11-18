import { z } from 'zod';

export const emailSchema = z
  .email()
  .trim()
  .max(254)
  .transform((value) => value.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use no more than 128 characters.');
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const registrationSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.').max(100),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  });
export const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  });

// Keep redirects within a small set of application destinations. Never trust next/Host.
export function safeNext(value: unknown, fallback = '/account') {
  if (typeof value !== 'string' || value.length > 500 || /[\\\x00-\x20]/.test(value))
    return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (
    decoded.includes('%') ||
    /[\\\x00-\x20]/.test(decoded) ||
    !decoded.startsWith('/') ||
    decoded.startsWith('//')
  )
    return fallback;
  const path = decoded.split(/[?#]/)[0];
  if (
    !['/account', '/admin', '/invite'].some(
      (prefix) => path === prefix || path.startsWith(prefix + '/'),
    )
  )
    return fallback;
  // Invite capabilities are carried in a fragment and must never be copied into login URLs.
  if (decoded.includes('?') || decoded.includes('#')) return fallback;
  return decoded;
}

export const staffAccessSchema = z.object({
  restaurant_id: z.uuid(),
  role_name: z.string(),
  is_owner: z.boolean(),
  permissions: z.array(z.string()),
});
export type StaffAccess = z.infer<typeof staffAccessSchema>;
export const roleSchema = z.object({
  id: z.union([z.uuid(), z.literal('')]),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  permissions: z.array(z.string().max(50)).max(30),
});
export const invitationSchema = z.object({ email: emailSchema, role: z.uuid() });
export const memberSchema = z.object({
  member: z.uuid(),
  role: z.uuid(),
  extraRoles: z.array(z.uuid()).max(20),
  status: z.enum(['active', 'suspended']),
});
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
