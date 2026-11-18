import { AuthPage } from '@/components/customer/auth-page';
export const metadata = { title: 'Reset password' };
export const dynamic = 'force-dynamic';
export default function ForgotPasswordPage() {
  return <AuthPage mode="forgot" />;
}
