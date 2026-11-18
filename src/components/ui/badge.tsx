import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const variants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none',
  {
    variants: {
      variant: {
        default: 'border-primary/15 bg-primary/10 text-brand-strong',
        secondary: 'border-border bg-secondary text-muted-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof variants>) {
  return <span data-slot="badge" className={cn(variants({ variant }), className)} {...props} />;
}
