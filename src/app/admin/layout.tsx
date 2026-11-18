import type { Metadata } from 'next';
import { Info, Layers } from 'lucide-react';
import { Brand } from '@/components/shared/brand';
import { WorkspaceNavigation } from '@/components/admin/workspace-navigation';
import { WorkspaceHeader } from '@/components/admin/workspace-header';
import { requireStaff } from '@/features/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Workspace', template: '%s | Restaurant workspace' },
  robots: { index: false, follow: false },
};
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireStaff();
  return (
    <div className="admin-theme min-h-screen bg-background font-sans text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-800 bg-[#111827] p-5 lg:flex">
        <div className="mb-9 mt-2 px-1">
          <Brand admin />
        </div>
        <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto">
          <WorkspaceNavigation permissions={access.permissions} />
        </div>
        <div className="mt-7 rounded-lg border border-white/10 bg-white/[.035] p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <Layers className="size-4 text-blue-300" />
            Phase 8 - Reports
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-400">
            One connected platform.
            <br />
            Built one tested phase at a time.
          </p>
        </div>
        <div className="mt-5 px-2 text-[9px] text-slate-500">
          Saffron &amp; Ember · Sample restaurant
        </div>
      </aside>
      <div className="lg:pl-60">
        <WorkspaceHeader permissions={access.permissions} roleName={access.role_name} />
        <div className="flex items-start gap-2.5 border-b bg-blue-50/80 px-5 py-2.5 text-[11px] leading-5 text-blue-900 sm:px-7">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Signed in as {access.role_name}. Your restaurant role controls access. Operational
            modules are being developed in the next phases.
          </p>
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1500px] px-5 py-7 outline-none sm:px-7 sm:py-8 lg:px-9"
        >
          {children}
        </main>
        <footer className="mx-5 flex flex-wrap justify-between gap-2 border-t py-5 text-[10px] text-muted-foreground sm:mx-7 lg:mx-9">
          <span>Restaurant management, thoughtfully connected.</span>
          <span>Version 1 foundation · No live operations</span>
        </footer>
      </div>
    </div>
  );
}
