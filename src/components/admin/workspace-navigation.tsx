'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  UsersRound,
  ShieldCheck,
  MessageSquare,
  ChartNoAxesCombined,
  Activity,
  Settings,
  Globe,
  Palette,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import { adminModules } from '@/lib/site';
import { cn } from '@/lib/utils';
import { visibleModule } from '@/features/auth/permissions';

const icons = {
  orders: ClipboardList,
  menu: UtensilsCrossed,
  customers: UsersRound,
  staff: ShieldCheck,
  support: MessageSquare,
  reports: ChartNoAxesCombined,
  activity: Activity,
  settings: Settings,
  website: Globe,
};
export function WorkspaceNavigation({
  onNavigate,
  permissions,
}: {
  onNavigate?: () => void;
  permissions: readonly string[];
}) {
  const pathname = usePathname();
  const links = [
    { href: '/admin', title: 'Overview', icon: LayoutDashboard },
    { href: '/admin/database', title: 'Database setup', icon: Database },
    ...adminModules
      .filter((module) => visibleModule(module.slug, permissions))
      .map((module) => ({
        href: `/admin/${module.slug}`,
        title: module.title,
        icon: icons[module.icon],
      })),
  ];
  return (
    <>
      <p className="px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-slate-500">
        Workspace
      </p>
      <nav aria-label="Workspace navigation" className="mt-4 grid gap-1">
        {links.map(({ href, title, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={pathname === href ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors',
              pathname === href
                ? 'bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400/15'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
            )}
          >
            <Icon className="size-[17px] shrink-0" strokeWidth={1.6} />
            {title}
          </Link>
        ))}
      </nav>
      <div className="mt-7 border-t border-white/10 pt-5">
        <p className="px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-slate-500">
          Foundation
        </p>
        <Link
          href="/admin/design-system"
          onClick={onNavigate}
          aria-current={pathname === '/admin/design-system' ? 'page' : undefined}
          className={cn(
            'mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium',
            pathname === '/admin/design-system'
              ? 'bg-blue-500/15 text-blue-200'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
          )}
        >
          <Palette className="size-[17px]" strokeWidth={1.6} />
          Design system
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-100"
        >
          <ArrowUpRight className="size-[17px]" strokeWidth={1.6} />
          View customer website
        </Link>
      </div>
    </>
  );
}
