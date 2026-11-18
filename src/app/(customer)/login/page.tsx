import { AuthPage } from '@/components/customer/auth-page';
import { safeNext } from '@/features/auth/validation';
export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const notices: Record<string, string> = {
    signed_out: 'You have been signed out.',
    password_updated: 'Password updated. Sign in with your new password.',
    link_invalid: 'This email link is invalid or has expired. Request a fresh link.',
    email_confirmed: 'Your email is confirmed. You can sign in.',
  };
  return (
    <AuthPage mode="login" next={safeNext(params.next)} notice={notices[params.notice || '']} />
  );
}
