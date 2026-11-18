import Link from 'next/link';
import DatabaseSetup from '@/components/admin/database-setup';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Platform setup' };
export const dynamic = 'force-dynamic';
export default function SetupPage() {
  return (
    <div className="admin-theme mx-auto min-h-screen max-w-6xl bg-background px-5 py-12 font-sans sm:px-10">
      <div className="mb-8 flex gap-3">
        <Button asChild size="sm">
          <Link href="/register">Create your account</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
      <DatabaseSetup />
    </div>
  );
}
