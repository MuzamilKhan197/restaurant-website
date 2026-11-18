'use client';

import * as React from 'react';
import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
      <Primitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-auto rounded-2xl border border-border bg-background p-6 shadow-xl outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn('pr-8 text-xl font-semibold', className)} {...props} />;
}
export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}
