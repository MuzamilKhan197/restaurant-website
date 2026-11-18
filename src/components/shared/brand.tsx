import Link from 'next/link';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Brand({ admin = false, className }: { admin?: boolean; className?: string }) {
  return (
    <Link
      href={admin ? '/admin' : '/'}
      className={cn('inline-flex shrink-0 items-center gap-2.5', className)}
      aria-label={admin ? 'Saffron & Ember workspace home' : 'Saffron & Ember home'}
    >
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-xl',
          admin ? 'bg-orange-500 text-slate-950' : 'bg-foreground text-orange-400',
        )}
      >
        <Flame className="size-5" aria-hidden="true" />
      </span>
      <span>
        <span
          className={cn(
            'block leading-tight tracking-tight',
            admin ? 'text-sm font-semibold text-white' : 'font-serif text-[21px] font-medium',
          )}
        >
          Saffron <span className={admin ? 'text-orange-300' : 'text-orange-700'}>&amp;</span> Ember
        </span>
        <span
          className={cn(
            'mt-1 block text-[8px] font-medium uppercase tracking-[.2em]',
            admin ? 'text-slate-400' : 'text-muted-foreground',
          )}
        >
          {admin ? 'Restaurant workspace' : 'Kitchen & gathering place'}
        </span>
      </span>
    </Link>
  );
}
