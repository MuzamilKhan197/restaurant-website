import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';
import { EXPECTED_SCHEMA_VERSION } from './schema-version';

export { EXPECTED_SCHEMA_VERSION } from './schema-version';

export type DatabaseStatus =
  'not_configured' | 'invalid_configuration' | 'unreachable' | 'schema_mismatch' | 'ready';

export async function getDatabaseStatus(): Promise<{
  status: DatabaseStatus;
  schemaVersion: number | null;
}> {
  try {
    const config = getSupabaseConfig();
    if (!config) return { status: 'not_configured', schemaVersion: null };
    // Public, constant-only RPC. Never use service credentials for a readiness check.
    const client = createClient<Database>(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(4000), cache: 'no-store' }),
      },
    });
    const { data, error } = await client.rpc('platform_schema_version');
    if (error)
      return {
        status: error.code === 'PGRST202' ? 'schema_mismatch' : 'unreachable',
        schemaVersion: null,
      };
    return {
      status: data === EXPECTED_SCHEMA_VERSION ? 'ready' : 'schema_mismatch',
      schemaVersion: data,
    };
  } catch {
    // Avoid returning URLs, keys or upstream exception messages to public callers.
    return { status: 'invalid_configuration', schemaVersion: null };
  }
}
