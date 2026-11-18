import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Access unavailable' };
export default function AccessDenied() {
  return (
    <section className="site-container max-w-xl py-24 text-center">
      <ShieldX className="mx-auto size-10 text-brand-strong" />
      <h1 className="mt-6 font-display text-4xl">This space is for your team.</h1>
      <p className="mt-5 text-sm leading-7 text-muted-foreground">
        Your account does not have active access to this workspace or section. Ask the restaurant
        owner to review your role.
      </p>
      <Button asChild className="mt-8">
        <Link href="/account">Back to my account</Link>
      </Button>
    </section>
  );
}
