import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6 lg:col-span-2">
          <Skeleton className="h-5 w-64 mb-4" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
