import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { storefrontService } from './storefront.service'
import { OrderTrackingCard } from './components/OrderTrackingCard'
import { Skeleton } from '@/components/ui/skeleton'

export function TrackOrderPage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('order') ?? '')
  const [submitted, setSubmitted] = useState(searchParams.get('order') ?? '')

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ['storefront', 'track', submitted],
    queryFn: () => storefrontService.trackOrder(submitted),
    enabled: submitted.length > 0,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(query.trim())
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl text-stone-900">Track Your Order</h1>
      <p className="mt-1 text-sm text-stone-500">Search by Order ID or phone number</p>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Order ID or phone number"
          className="flex-1"
        />
        <Button type="submit" className="rounded-full px-6">
          <Search className="mr-2 h-4 w-4" /> Track
        </Button>
      </form>

      {isLoading && submitted && (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
      )}

      {isFetched && submitted && !data && (
        <p className="mt-8 rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500">
          No order found for &quot;{submitted}&quot;
        </p>
      )}

      {data && <div className="mt-8"><OrderTrackingCard tracking={data} /></div>}
    </div>
  )
}
