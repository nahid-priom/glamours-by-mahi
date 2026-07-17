import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ProductCardSkeletonProps {
  variant?: 'default' | 'large'
}

export function ProductCardSkeleton({ variant = 'default' }: ProductCardSkeletonProps) {
  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border border-pink-100 bg-white',
        variant === 'large' && 'sm:col-span-1',
      )}
    >
      <Skeleton className="aspect-square shrink-0 rounded-none" />
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <Skeleton className="h-3 w-14 rounded-full" />
        <Skeleton className="mt-1 h-[32px] w-full rounded-md sm:h-[38px]" />
        <Skeleton className="mt-1 h-5 w-1/2 rounded-md sm:h-6" />
        <Skeleton className="mt-1 h-4 w-20 rounded-full" />
        <Skeleton className="mt-auto h-9 w-full rounded-xl sm:h-10" />
      </div>
    </article>
  )
}

interface ProductGridSkeletonProps {
  count?: number
  variant?: 'default' | 'large'
}

export function ProductGridSkeleton({ count = 8, variant = 'default' }: ProductGridSkeletonProps) {
  return (
    <div
      className={cn(
        'grid gap-3',
        variant === 'large'
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}
