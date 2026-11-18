'use client';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function PageError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="site-container flex min-h-[70vh] flex-col items-center justify-center py-20 text-center"
    >
      <AlertCircle className="size-9 text-brand-strong" />
      <h1 className="mt-6 text-2xl font-semibold">Something didn’t load.</h1>
      <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
        Please try again. If this keeps happening, return to the homepage and try another page.
      </p>
      <div className="mt-7 flex gap-3">
        <Button onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
