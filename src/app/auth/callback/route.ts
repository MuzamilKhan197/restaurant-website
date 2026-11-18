import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppUrl } from '@/features/auth/config';
import { safeNext } from '@/features/auth/validation';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const destination =
    request.nextUrl.searchParams.get('next') === '/reset-password'
      ? '/reset-password'
      : safeNext(request.nextUrl.searchParams.get('next'));
  if (code && code.length < 2048) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(`${getAppUrl()}${destination}`, {
        headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
      });
  }
  return NextResponse.redirect(`${getAppUrl()}/login?notice=link_invalid`);
}
