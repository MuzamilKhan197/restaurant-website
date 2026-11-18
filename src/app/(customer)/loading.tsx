import { Skeleton } from '@/components/ui/skeleton';
export default function CustomerLoading() {
  return (
    <div className="site-container py-16" role="status" aria-label="Loading page">
      <div className="mx-auto mb-12 max-w-lg space-y-5">
        <Skeleton className="mx-auto h-3 w-36" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="mx-auto h-4 w-3/4" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="space-y-4 rounded-xl border p-4">
            <Skeleton className="aspect-[1.35] w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading content. Please wait.</span>
    </div>
  );
}
