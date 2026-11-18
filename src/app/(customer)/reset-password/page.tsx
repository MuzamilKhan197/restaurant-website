import { AuthPage } from '@/components/customer/auth-page';
import { requireUser } from '@/features/auth/session';
export const metadata = { title: 'New password' };
export const dynamic = 'force-dynamic';
export default async function ResetPasswordPage() {
  await requireUser();
  return <AuthPage mode="reset" />;
}
