import { requireStorefrontAvailable } from '@/features/storefront/availability';
import { AuthPage } from '@/components/customer/auth-page';
export const metadata = { title: 'Create account' };
export const dynamic = 'force-dynamic';
export default async function RegisterPage() {
  await requireStorefrontAvailable();
  return <AuthPage mode="register" />;
}
