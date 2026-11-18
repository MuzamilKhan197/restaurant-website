import Link from 'next/link';
import { requireUser } from '@/features/auth/session';
export const dynamic = 'force-dynamic';
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <nav
        aria-label="Account navigation"
        className="site-container flex flex-wrap gap-6 border-b py-5 text-sm"
      >
        <Link href="/account" className="underline">
          Profile
        </Link>
        <Link href="/account/addresses" className="underline">
          Saved addresses
        </Link>
        <Link href="/account/orders" className="underline">
          Order history
        </Link>
        <Link href="/account/support" className="underline">
          Support tickets
        </Link>
      </nav>
      {children}
    </>
  );
}
