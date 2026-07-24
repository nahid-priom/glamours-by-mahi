import { Skeleton } from '@/components/ui/skeleton'

export function ProductListSkeleton({ variant = 'page' }: { variant?: 'page' | 'desktop' | 'mobile' }) {
  if (variant === 'mobile') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-white p-3">
            <div className="flex gap-3">
              <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'desktop') {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={groupIndex} className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
            <div className="space-y-0 p-3">
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-11 w-11 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <ProductListSkeleton variant="desktop" />
    </div>
  )
}
