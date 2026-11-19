import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { Brand } from '@/components/shared/brand';
import { WorkspaceNavigation } from '@/components/admin/workspace-navigation';
import { WorkspaceHeader } from '@/components/admin/workspace-header';
import { requireStaff, requireUser } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Workspace', template: '%s | Restaurant workspace' },
  robots: { index: false, follow: false },
};
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireStaff();
  const user = await requireUser('/admin');
  const client = await createClient();
  const { data: profile } = await client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const displayName = profile?.display_name.trim() || '';
  const nameParts = displayName.split(/\s+/);
  const initials = (
    (Array.from(nameParts[0])[0] || Array.from(user.email || '')[0] || '?') +
    (nameParts.length > 1 ? Array.from(nameParts.at(-1) || '')[0] : '')
  ).toLocaleUpperCase();
  return (
    <div className="admin-theme min-h-screen bg-background font-sans text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-800 bg-[#111827] p-5 lg:flex">
        <div className="mb-9 mt-2 px-1">
          <Brand admin />
        </div>
        <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto">
          <WorkspaceNavigation permissions={access.permissions} />
        </div>
        <div className="mt-5 px-2 text-[9px] text-slate-500">
          Saffron &amp; Ember · Sample restaurant
        </div>
      </aside>
      <div className="lg:pl-60">
        <WorkspaceHeader
          permissions={access.permissions}
          roleName={access.role_name}
          displayName={displayName}
          initials={initials}
        />
        <div className="flex items-start gap-2.5 border-b bg-blue-50/80 px-5 py-2.5 text-[11px] leading-5 text-blue-900 sm:px-7">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>Signed in as {access.role_name}. Your restaurant role controls access.</p>
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
          <span>Restaurant workspace · V1</span>
        </footer>
      </div>
    </div>
  );
}
