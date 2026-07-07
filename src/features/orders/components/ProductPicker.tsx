import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { productsService } from '@/features/products/products.service'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface ProductSelection {
  product_id?: string
  product_name: string
  sku?: string
  unit_price: number
  available_stock?: number
  is_custom?: boolean
}

interface ProductPickerProps {
  storeId?: string
  value: ProductSelection | null
  onChange: (selection: ProductSelection) => void
  quantity: number
}

export function ProductPicker({ storeId, value, onChange, quantity }: ProductPickerProps) {
  const [query, setQuery] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customName, setCustomName] = useState('')

  const { data: products } = useQuery({
    queryKey: ['products', 'picker', storeId],
    queryFn: () => productsService.getProducts({ store: storeId, status: 'active' }),
    enabled: !!storeId,
  })

  const filtered = useMemo(() => {
    if (!products) return []
    const q = query.toLowerCase()
    if (!q) return products.slice(0, 8)
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8)
  }, [products, query])

  const stockWarning = value?.available_stock !== undefined && quantity > value.available_stock

  const selectProduct = (p: (typeof filtered)[0]) => {
    setCustomMode(false)
    onChange({
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      unit_price: p.price,
      available_stock: p.stock,
      is_custom: false,
    })
    setQuery(p.name)
  }

  const useCustomProduct = () => {
    if (!customName.trim()) return
    onChange({
      product_name: customName.trim(),
      unit_price: value?.unit_price ?? 0,
      is_custom: true,
    })
    setCustomMode(false)
    setQuery(customName.trim())
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="Search product by name or SKU..."
          className="pl-9"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!e.target.value) onChange({ product_name: '', unit_price: 0, is_custom: true })
          }}
        />
      </div>

      {!customMode && query && filtered.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-white shadow-sm">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => selectProduct(p)}
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-text-muted">{p.sku} · Stock: {p.stock}</p>
              </div>
              <span className="text-xs font-semibold">{formatBDT(p.price)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="text-xs font-medium text-primary hover:underline"
        onClick={() => setCustomMode(true)}
      >
        + Use custom product name
      </button>

      {customMode && (
        <div className="flex gap-2">
          <Input
            placeholder="Custom product name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <Button type="button" size="sm" onClick={useCustomProduct}>Use</Button>
        </div>
      )}

      {value?.product_name && (
        <div className={cn('rounded-xl border p-3 text-sm', stockWarning ? 'border-warning bg-amber-50' : 'border-border bg-slate-50')}>
          <p className="font-medium">{value.product_name}</p>
          {value.sku && <p className="text-xs text-text-muted">SKU: {value.sku}</p>}
          <p className="text-xs">Unit price: {formatBDT(value.unit_price)}</p>
          {value.available_stock !== undefined && (
            <p className="text-xs text-text-muted">Available: {value.available_stock}</p>
          )}
          {stockWarning && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
              <AlertTriangle className="h-3 w-3" />
              Quantity exceeds available stock
            </p>
          )}
        </div>
      )}
    </div>
  )
}
