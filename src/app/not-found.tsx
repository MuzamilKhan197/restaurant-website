import Link from 'next/link';
import { ArrowLeft, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="site-container flex min-h-screen flex-col items-center justify-center py-20 text-center"
    >
      <Flame className="size-10 text-brand-strong" strokeWidth={1.3} />
      <p className="eyebrow mt-8">404 · A little off the menu</p>
      <h1 className="editorial-heading mt-5 text-5xl sm:text-6xl">
        This page has
        <br />
        <em className="font-normal text-brand-strong">left the table.</em>
      </h1>
      <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
        The link may have changed. There’s still something good waiting for you.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">
          <ArrowLeft />
          Back to our table
        </Link>
      </Button>
    </main>
  );
}
