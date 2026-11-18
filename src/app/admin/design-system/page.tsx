import type { Metadata } from 'next';
import { Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { DesignPreview } from '@/components/admin/design-preview';
export const metadata: Metadata = { title: 'Design system' };

export default function DesignSystemPage() {
  return (
    <>
      <Badge variant="success">
        <Palette className="size-3" />
        Shared foundation
      </Badge>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        One product. Two thoughtful themes.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Reusable primitives, clear states and accessible interactions. The storefront feels warm;
        the workspace stays focused.
      </p>
      <div className="my-7 grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer palette</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { colour: '#FAF7F2', label: 'Cream', className: 'bg-[#FAF7F2]' },
                { colour: '#F97316', label: 'Orange', className: 'bg-[#F97316]' },
                { colour: '#171717', label: 'Charcoal', className: 'bg-[#171717]' },
              ].map((item) => (
                <div key={item.colour}>
                  <div className={`h-16 rounded-lg border ${item.className}`} />
                  <p className="mt-3 text-[11px] font-medium">{item.label}</p>
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">{item.colour}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Workspace palette</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { colour: '#111827', label: 'Navy', className: 'bg-[#111827]' },
                { colour: '#2563EB', label: 'Action blue', className: 'bg-[#2563EB]' },
                { colour: '#F6F7FB', label: 'Canvas', className: 'bg-[#F6F7FB]' },
              ].map((item) => (
                <div key={item.colour}>
                  <div className={`h-16 rounded-lg border ${item.className}`} />
                  <p className="mt-3 text-[11px] font-medium">{item.label}</p>
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">{item.colour}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <DesignPreview />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Loading state</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4" role="img" aria-label="Loading skeleton example">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="size-12" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Animation respects reduced-motion preferences.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Empty state</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No records to show."
              description="Explain what belongs here and give the user a useful next step. Never fill empty dashboards with invented data."
              className="py-6"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
