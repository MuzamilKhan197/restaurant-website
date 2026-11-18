import { Skeleton } from '@/components/ui/skeleton';
export default function WorkspaceLoading() {
  return (
    <div role="status" aria-label="Loading workspace">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-4 h-4 w-3/4" />
      <div className="mt-8 grid grid-cols-2 gap-5 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-32" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 w-full" />
      <span className="sr-only">Loading workspace. Please wait.</span>
    </div>
  );
}
