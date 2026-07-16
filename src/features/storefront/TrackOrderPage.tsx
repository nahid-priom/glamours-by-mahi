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
    <div className="sf-container mx-auto max-w-2xl py-8">
      <h1 className="font-serif text-3xl text-[var(--sf-ink)]">Track Your Order</h1>
      <p className="mt-1 text-sm text-[var(--sf-muted)]">Search by Order ID or phone number</p>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Order ID or phone number"
          className="flex-1 rounded-full border-[var(--sf-border)]"
        />
        <Button
          type="submit"
          className="rounded-full bg-[var(--sf-primary)] px-6 hover:bg-[var(--sf-primary-hover)]"
        >
          <Search className="mr-2 h-4 w-4" /> Track
        </Button>
      </form>

      {isLoading && submitted ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
      ) : null}

      {isFetched && submitted && !data ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[var(--sf-border)] bg-white py-12 text-center text-sm text-[var(--sf-muted)]">
          No order found for &quot;{submitted}&quot;. Try another ID or browse the shop.
        </p>
      ) : null}

      {data ? (
        <div className="mt-8">
          <OrderTrackingCard tracking={data} />
        </div>
      ) : null}
    </div>
  )
}
