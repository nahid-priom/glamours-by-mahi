import { Card, CardContent } from '@/components/ui/card'

export function LoadingCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <div className="h-4 w-2/5 max-w-[40%] animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-3/5 max-w-[60%] animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-4/5 max-w-[80%] animate-pulse rounded bg-slate-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
