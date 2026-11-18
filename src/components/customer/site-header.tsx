'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Menu, ShoppingBag, UserRound } from 'lucide-react';
import { Brand } from '@/components/shared/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { site } from '@/lib/site';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="bg-[#253b31] px-4 py-2 text-center text-[10px] tracking-wide text-white/90">
        A little warmth. A lot of flavour.
        <span className="ml-2 hidden sm:inline">Welcome to your next favourite table.</span>
        <span className="ml-3 inline-block rounded border border-white/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wider">
          Sample restaurant
        </span>
      </div>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
        <div className="site-container flex h-20 items-center justify-between gap-4">
          <Brand />
          <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
            {site.customerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className={cn(
                  'relative py-6 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                  pathname === link.href &&
                    'text-brand-strong after:absolute after:bottom-3 after:left-1/2 after:size-1 after:rounded-full after:bg-primary',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link href="/account" aria-label="My account">
                <UserRound />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link href="/cart" aria-label="Shopping bag">
                <ShoppingBag />
              </Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/menu">
                Explore the menu <ArrowUpRight />
              </Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu />
                </Button>
              </DialogTrigger>
              <DialogContent className="top-6 max-w-sm translate-y-0">
                <DialogTitle>Pull up a chair.</DialogTitle>
                <DialogDescription>Find something good at Saffron &amp; Ember.</DialogDescription>
                <nav aria-label="Mobile navigation" className="grid gap-1">
                  {[
                    ...site.customerLinks,
                    { href: '/account', label: 'My account' },
                    { href: '/help', label: 'Help center' },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={pathname === link.href ? 'page' : undefined}
                      className="flex items-center justify-between rounded-lg px-3 py-3 text-sm hover:bg-accent"
                    >
                      {link.label}
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    </Link>
                  ))}
                </nav>
                <Badge variant="outline" className="w-fit">
                  Browse our menu or view your cart
                </Badge>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
    </>
  );
}
