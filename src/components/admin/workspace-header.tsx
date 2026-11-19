'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, ArrowUpRight, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Brand } from '@/components/shared/brand';
import { WorkspaceNavigation } from './workspace-navigation';
import { adminModules } from '@/lib/site';
import { visibleModule } from '@/features/auth/permissions';

export function WorkspaceHeader({
  permissions,
  roleName,
  displayName,
  initials,
}: {
  permissions: readonly string[];
  roleName: string;
  displayName: string;
  initials: string;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pathname = usePathname();
  const current =
    adminModules.find((module) => pathname === `/admin/${module.slug}`)?.title ||
    (pathname === '/admin/design-system'
      ? 'Design system'
      : pathname === '/admin/database'
        ? 'Database setup'
        : 'Overview');
  const options = [
    { href: '/admin', title: 'Overview', description: 'Foundation setup and project roadmap' },
    {
      href: '/admin/database',
      title: 'Database setup',
      description: 'Connection readiness, schema and security',
    },
    ...adminModules
      .filter((module) => visibleModule(module.slug, permissions))
      .map((module) => ({
        href: `/admin/${module.slug}`,
        title: module.title,
        description: module.description,
      })),
    {
      href: '/admin/design-system',
      title: 'Design system',
      description: 'Shared components, colours and interaction states',
    },
  ].filter((item) =>
    `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur-md sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open workspace navigation"
            >
              <Menu />
            </Button>
          </DialogTrigger>
          <DialogContent className="admin-theme top-4 max-w-sm translate-y-0 border-slate-700 bg-[#111827] text-white">
            <DialogTitle className="text-sm">Restaurant workspace</DialogTitle>
            <DialogDescription className="sr-only">
              Navigate the restaurant workspace and foundation tools.
            </DialogDescription>
            <Brand admin />
            <WorkspaceNavigation
              onNavigate={() => setNavigationOpen(false)}
              permissions={permissions}
            />
          </DialogContent>
        </Dialog>
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="hidden text-muted-foreground sm:inline">Workspace</span>
          <ChevronRight className="hidden size-3 text-slate-400 sm:inline" />
          <span className="truncate font-medium">{current}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <Dialog
          open={searchOpen}
          onOpenChange={(value) => {
            setSearchOpen(value);
            if (!value) setQuery('');
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-3 text-muted-foreground"
              aria-label="Find a workspace section"
            >
              <Search />
              <span className="hidden md:inline">Find a section…</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="admin-theme">
            <DialogTitle>Find your way.</DialogTitle>
            <DialogDescription>
              Jump to a workspace section. Planned features are clearly marked on each page.
            </DialogDescription>
            <label>
              <span className="sr-only">Search workspace sections</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search orders, menu, support…"
              />
            </label>
            <div className="max-h-80 overflow-y-auto">
              {options.length ? (
                options.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                  No matching sections. Try a different search.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <Badge variant="outline" className="hidden sm:inline-flex">
          {roleName}
        </Badge>
        <span
          className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600"
          role="img"
          aria-label={displayName || 'Signed-in staff account'}
          title={displayName || undefined}
        >
          {initials}
        </span>
        <Button asChild variant="ghost" size="icon" className="hidden xl:inline-flex">
          <Link href="/" aria-label="Open customer website">
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </header>
  );
}
