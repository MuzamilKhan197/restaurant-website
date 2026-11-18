import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppUrl } from '@/features/auth/config';
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  if (
    token &&
    token.length < 2048 &&
    (type === 'signup' || type === 'recovery' || type === 'email')
  ) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({ token_hash: token, type });
    if (!error)
      return NextResponse.redirect(
        `${getAppUrl()}${type === 'recovery' ? '/reset-password' : '/account'}`,
        { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } },
      );
  }
  return NextResponse.redirect(`${getAppUrl()}/login?notice=link_invalid`);
}
