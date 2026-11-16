import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { profitPreview, type VariantDraft } from '../../lib/variant-matrix'
import { PM } from '../../lib/product-module-theme'

type Props = {
  variants: VariantDraft[]
  onChange: (next: VariantDraft[]) => void
  onBulkRetail?: (price: number) => void
  onBulkPurchase?: (price: number) => void
}

export function VariantPricingMatrix({ variants, onChange, onBulkRetail, onBulkPurchase }: Props) {
  const updateRow = (key: string, patch: Partial<VariantDraft>) => {
    onChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  if (variants.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-6 text-center text-sm text-[#6B7280]">
        Generate variants in the previous step to edit SKUs, barcodes, and prices.
      </p>
    )
  }

  return (
    <div className="product-module space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label className="text-sm font-semibold text-[#111111]">Variant matrix</Label>
          <p className="text-xs text-[#6B7280]">{variants.length} combinations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onBulkPurchase ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={PM.btnOutline}
              onClick={() => {
                const raw = window.prompt('Set purchase price for all variants')
                if (raw == null) return
                const n = Number(raw)
                if (!Number.isFinite(n) || n < 0) return
                onBulkPurchase(n)
              }}
            >
              Bulk purchase
            </Button>
          ) : null}
          {onBulkRetail ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={PM.btnOutline}
              onClick={() => {
                const raw = window.prompt('Set retail price for all variants')
                if (raw == null) return
                const n = Number(raw)
                if (!Number.isFinite(n) || n < 0) return
                onBulkRetail(n)
              }}
            >
              Bulk retail
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#FFF1F2] text-xs uppercase tracking-wide text-[#9F1239]">
            <tr>
              <th className="px-3 py-2 font-semibold">Variant</th>
              <th className="px-3 py-2 font-semibold">SKU</th>
              <th className="px-3 py-2 font-semibold">Barcode</th>
              <th className="px-3 py-2 font-semibold">Purchase</th>
              <th className="px-3 py-2 font-semibold">Retail</th>
              <th className="px-3 py-2 font-semibold">Margin</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const margin = profitPreview(v.purchase_price, v.selling_price)
              return (
                <tr key={v.key} className="border-t border-border bg-white">
                  <td className="px-3 py-2 font-medium text-[#111111]">{v.label}</td>
                  <td className="px-3 py-2">
                    <Input
                      value={v.sku}
                      className="h-8 min-w-[8rem]"
                      onChange={(e) => updateRow(v.key, { sku: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={v.barcode}
                      className="h-8 min-w-[7rem]"
                      inputMode="numeric"
                      onChange={(e) =>
                        updateRow(v.key, {
                          barcode: e.target.value.replace(/\D/g, '').slice(0, 32),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 w-24"
                      value={v.purchase_price}
                      onChange={(e) =>
                        updateRow(v.key, { purchase_price: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 w-24"
                      value={v.selling_price}
                      onChange={(e) =>
                        updateRow(v.key, { selling_price: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-[#6B7280]">
                    {margin.margin.toFixed(0)}% · {formatBDT(margin.profit)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
