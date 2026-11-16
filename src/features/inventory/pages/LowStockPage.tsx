import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { getInventoryLowStock } from '../repositories/inventory-valuation.repository'

export function LowStockPage() {
  const { activeBranchId } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filters = {
    branchId: activeBranchId,
    search,
    page,
    pageSize: 50,
  }
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.inventoryLowStock(filters),
    queryFn: () => getInventoryLowStock(filters),
    enabled: Boolean(activeBranchId),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total_count ?? 0) / 50))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Low stock</h1>
        <p className="text-sm text-[#6B7280]">Variants at or below reorder level.</p>
      </div>

      {!activeBranchId ? (
        <p className="text-sm text-[#E11D48]">Select a branch to view low stock.</p>
      ) : null}

      <Input
        placeholder="Search…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        className="max-w-sm"
        disabled={!activeBranchId}
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load low stock.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Reorder</TableHead>
              <TableHead className="text-right">Shortage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.row_key}>
                <TableCell className="font-medium">{row.product_name}</TableCell>
                <TableCell>{row.sku}</TableCell>
                <TableCell className="text-[#6B7280]">{row.branch_name}</TableCell>
                <TableCell className="text-right font-medium text-[#E11D48]">
                  {row.available_quantity}
                </TableCell>
                <TableCell className="text-right">{row.reorder_level}</TableCell>
                <TableCell className="text-right text-[#E11D48]">{row.shortage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="self-center text-sm text-[#6B7280]">
            Page {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
