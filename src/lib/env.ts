import { z } from 'zod';

export const publicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
  })
  .superRefine((values, context) => {
    const url = Boolean(values.NEXT_PUBLIC_SUPABASE_URL);
    const key = Boolean(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    if (url !== key)
      context.addIssue({
        code: 'custom',
        message: 'Configure both the Supabase URL and its public publishable key.',
        path: [url ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : 'NEXT_PUBLIC_SUPABASE_URL'],
      });
    const publicKey = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (publicKey && !publicKey.startsWith('sb_publishable_'))
      context.addIssue({
        code: 'custom',
        message: 'Use an sb_publishable_ public key, never a secret or service-role key.',
        path: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
      });
    const localUrl =
      values.NEXT_PUBLIC_SUPABASE_URL &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(values.NEXT_PUBLIC_SUPABASE_URL);
    if (
      values.NEXT_PUBLIC_SUPABASE_URL &&
      !values.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://') &&
      !localUrl
    )
      context.addIssue({
        code: 'custom',
        message: 'Use an HTTPS Supabase URL.',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
      });
  });

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

// Explicitly select public values. Do not pass process.env or any private keys
// to a client component.
export function parsePublicEnvironment(values: Record<string, string | undefined>) {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: values.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  });
}
