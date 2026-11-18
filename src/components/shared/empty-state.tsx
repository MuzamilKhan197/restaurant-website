import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-background">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
