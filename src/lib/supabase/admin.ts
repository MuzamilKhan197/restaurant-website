import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';

// Bypasses RLS: call only from explicitly authorized backend operations.
// This is deliberately unused until the Phase 3 backend authorization guards exist.
export function createAdminClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key?.startsWith('sb_secret_'))
    throw new Error('Server Supabase configuration is missing or invalid.');
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
