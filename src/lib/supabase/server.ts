import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';

// Proxy refreshes cookies; protected routes verify the user with the Auth server.
// Never authorize a request using a session object supplied by the browser.
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase is not configured.');
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) store.set(name, value, options);
        } catch {
          /* Server Components cannot write cookies; the proxy refreshes them. */
        }
      },
    },
  });
}
