import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
export function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: [
    '/admin/:path*',
    '/account/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/auth/:path*',
    '/invite',
    '/access-denied',
    '/cart',
    '/track/:path*',
    '/support/:path*',
  ],
};
