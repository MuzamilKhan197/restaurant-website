import { parsePublicEnvironment } from '../env';

export function getSupabaseConfig() {
  const env = parsePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}
