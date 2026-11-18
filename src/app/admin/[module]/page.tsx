import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Layers, ShieldCheck } from 'lucide-react';
import { adminModules, developmentPhases } from '@/lib/site';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { requireStaff } from '@/features/auth/session';
import { visibleModule } from '@/features/auth/permissions';

export function generateStaticParams() {
  return adminModules.map((module) => ({ module: module.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module: slug } = await params;
  return {
    title: adminModules.find((module) => module.slug === slug)?.title || 'Section not found',
  };
}
export default async function PlannedModule({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const section = adminModules.find((module) => module.slug === slug);
  if (!section) notFound();
  const access = await requireStaff();
  if (!visibleModule(slug, access.permissions)) redirect('/access-denied');
  const phase = developmentPhases.find((phase) => phase.number === section.phase)!;
  return (
    <>
      <Badge variant="outline">Planned · Phase {phase.number}</Badge>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{section.title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{section.description}</p>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-sm">A place for the real thing.</CardTitle>
          <CardDescription>
            This section is reserved for the connected implementation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Layers}
            title={`${phase.title} is an upcoming phase.`}
            description={phase.summary}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/admin">
                  <ArrowLeft />
                  Back to the build overview
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
      <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-xl border bg-card p-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-slate-400" />
        <p className="text-xs leading-6 text-muted-foreground">
          Backend permissions, data validation and the necessary database policies will be
          implemented before this feature handles real customer data. This page does not provide
          operational access.
        </p>
      </div>
    </>
  );
}
