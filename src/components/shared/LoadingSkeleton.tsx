import { Skeleton } from '@/components/ui/skeleton'

interface LoadingSkeletonProps {
  rows?: number
  height?: string
}

export function LoadingSkeleton({ rows = 5, height = 'h-12' }: LoadingSkeletonProps) {
  return (
    <div className="space-y-2 p-4 sm:p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  )
}
