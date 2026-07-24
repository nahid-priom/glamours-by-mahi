import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, ShoppingBag } from 'lucide-react'
import { posRepository } from '@/features/pos/repositories/pos.repository'
import { useAuth } from '@/features/auth/auth-session'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query/keys'

export function HeldSalesPage() {
  const { activeBranchId } = useAuth()
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: [...queryKeys.heldSales, activeBranchId],
    queryFn: () => posRepository.listHeldSales(activeBranchId!),
    enabled: Boolean(activeBranchId),
  })

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Held Sales</h1>
          <p className="text-sm text-[#6B7280]">Resume carts that have not posted stock or accounting.</p>
        </div>
        <Button asChild>
          <Link to="/sales/pos">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Open POS
          </Link>
        </Button>
      </div>

      {!activeBranchId ? (
        <p className="text-sm text-[#E11D48]">Select a branch before viewing held sales.</p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading held carts…
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[#E11D48]">
          Could not load held sales. Confirm migrations are applied and RLS allows access.
        </p>
      ) : null}

      {!isLoading && !error && activeBranchId && data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No held sales. Use Hold on the POS screen to park a cart.
        </div>
      ) : null}

      <ul className="space-y-2">
        {data.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.hold_label || 'Held cart'}</p>
              <p className="text-xs text-[#9CA3AF]">
                {new Date(row.created_at).toLocaleString()} · ৳{Number(row.grand_total).toFixed(2)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/sales/pos?resume=${row.id}`}>Resume in POS</Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void posRepository.deleteHeldSale(row.id).then(() => refetch())
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
