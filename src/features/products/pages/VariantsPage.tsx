import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  listVariants,
  searchProducts,
  updateVariant,
  type VariantListItem,
} from '../repositories/catalog.repository'

type EditForm = {
  sku: string
  barcode: string
  name: string
  purchase_price: string
  selling_price: string
  wholesale_price: string
  is_active: boolean
}

export function VariantsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<VariantListItem | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)

  const onSearchProducts = useCallback((q: string) => searchProducts(q), [])

  const filters = { search, productId, page, pageSize: 50 }
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.variants(filters),
    queryFn: () => listVariants(filters),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing || !form) throw new Error('Nothing to save')
      return updateVariant(editing.id, {
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        name: form.name.trim() || null,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
        is_active: form.is_active,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variants'] })
      void qc.invalidateQueries({ queryKey: ['pos-products'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      toast('Variant updated')
      setEditing(null)
      setForm(null)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 50))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Variants</h1>
        <p className="text-sm text-[#6B7280]">SKU, barcode, prices, and display stock.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search SKU / barcode…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        />
        <div className="w-full max-w-xs">
          <EntityCombobox
            value={productId}
            onChange={(id) => {
              setProductId(id)
              setPage(1)
            }}
            onSearch={onSearchProducts}
            placeholder="Filter by product"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load variants.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.sku}</TableCell>
                <TableCell>
                  <p>{row.products?.name ?? '—'}</p>
                  <p className="text-xs text-[#9CA3AF]">{row.name ?? 'Default'}</p>
                </TableCell>
                <TableCell className="text-[#6B7280]">{row.barcode ?? '—'}</TableCell>
                <TableCell>{formatBDT(Number(row.selling_price))}</TableCell>
                <TableCell>{row.stockQty ?? 0}</TableCell>
                <TableCell>{row.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <PermissionGate permission="products.update">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(row)
                        setForm({
                          sku: row.sku,
                          barcode: row.barcode ?? '',
                          name: row.name ?? '',
                          purchase_price: String(row.purchase_price),
                          selling_price: String(row.selling_price),
                          wholesale_price:
                            row.wholesale_price != null ? String(row.wholesale_price) : '',
                          is_active: row.is_active,
                        })
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No variants found.</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
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
      </div>

      <Dialog
        open={Boolean(editing && form)}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null)
            setForm(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit variant</DialogTitle>
          </DialogHeader>
          {form ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
            >
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Barcode</Label>
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Cost</Label>
                  <Input
                    type="number"
                    value={form.purchase_price}
                    onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  Save
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
