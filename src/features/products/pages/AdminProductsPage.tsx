import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { AppImage } from '@/components/common/AppImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { ProductFormDialog } from '../components/ProductFormDialog'
import {
  listProducts,
  softDeleteProduct,
  type ProductListItem,
} from '../repositories/catalog.repository'

export function AdminProductsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductListItem | null>(null)

  const filters = { search, page, pageSize: 24 }
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: () => listProducts(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: softDeleteProduct,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      toast('Product deleted')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 24))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Products</h1>
          <p className="text-sm text-[#6B7280]">Admin catalog backed by Supabase.</p>
        </div>
        <PermissionGate permission="products.create">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add product
          </Button>
        </PermissionGate>
      </div>

      <Input
        placeholder="Search name, SKU, barcode…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load products.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <AppImage
                    src={row.coverUrl}
                    alt={row.name}
                    className="h-10 w-10 rounded-md"
                    aspectRatio="square"
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{row.base_sku ?? '—'}</p>
                </TableCell>
                <TableCell className="text-[#6B7280]">{row.categories?.name ?? '—'}</TableCell>
                <TableCell>{formatBDT(Number(row.selling_price))}</TableCell>
                <TableCell>
                  <Badge variant={row.is_active ? 'success' : 'default'}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <PermissionGate permission="products.update">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(row)
                          setOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#E11D48]"
                        onClick={() => {
                          if (confirm(`Delete “${row.name}”?`)) deleteMutation.mutate(row.id)
                        }}
                      >
                        Delete
                      </Button>
                    </PermissionGate>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No products found.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-[#6B7280]">
          {data?.total ?? 0} products · page {page}/{totalPages}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/products/variants">Variants</Link>
          </Button>
        </div>
      </div>

      {profile?.organization_id ? (
        <ProductFormDialog
          open={open}
          onOpenChange={setOpen}
          orgId={profile.organization_id}
          editing={editing}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['products'] })
            toast(editing ? 'Product updated' : 'Product created')
          }}
          onError={(m) => toast(m, 'error')}
        />
      ) : null}
    </div>
  )
}
