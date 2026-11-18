import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';
import { getAppUrl } from '@/features/auth/config';
import { safeNext } from '@/features/auth/validation';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let authenticated = false;
  const config = getSupabaseConfig();
  if (config) {
    const client = createServerClient<Database>(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    const { data } = await client.auth.getClaims();
    authenticated = Boolean(data?.claims?.sub);
  }
  const pathname = request.nextUrl.pathname;
  const protectedPath = ['/admin', '/account', '/invite', '/reset-password'].some(
    (path) => pathname === path || pathname.startsWith(path + '/'),
  );
  if (config && protectedPath && !authenticated) {
    const target = new URL('/login', getAppUrl());
    target.searchParams.set('next', safeNext(pathname));
    const denied = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
    denied.headers.set('Cache-Control', 'private, no-store');
    denied.headers.set('Referrer-Policy', 'no-referrer');
    return denied;
  }
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
