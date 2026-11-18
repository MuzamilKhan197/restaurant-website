import Link from 'next/link';
import { ArrowUpRight, Flame } from 'lucide-react';
import { Brand } from '@/components/shared/brand';

export function SiteFooter() {
  return (
    <footer className="border-t bg-[#f0ece4]">
      <div className="site-container grid gap-9 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            Good food. Great company.
            <br />A little warmth in every bite.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold">Pull up a chair</h2>
          <div className="mt-5 grid gap-3 text-xs text-muted-foreground">
            <Link href="/menu" className="hover:text-foreground">
              Our menu
            </Link>
            <Link href="/about" className="hover:text-foreground">
              Our story
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Visit us
            </Link>
            <Link href="/help" className="hover:text-foreground">
              Help center
            </Link>
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold">Come on over</h2>
          <p className="mt-5 text-xs leading-7 text-muted-foreground">
            Lahore, Pakistan
            <br />
            Sample location · address to be confirmed
          </p>
          <Link href="/contact" className="text-link mt-4">
            Say hello <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
      <div className="site-container flex flex-col justify-between gap-3 border-t py-5 text-[10px] text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Saffron &amp; Ember. Made for good company.</p>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <Flame className="size-3" /> Sample business · no live orders
          </span>
          <Link href="/admin" className="underline-offset-4 hover:underline">
            Workspace preview
          </Link>
        </div>
      </div>
    </footer>
  );
}
