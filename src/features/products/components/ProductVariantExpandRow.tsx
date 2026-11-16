import { formatBDT } from '@/lib/format'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  product: ProductListItem
}

export function ProductVariantExpandRow({ product }: Props) {
  const variants = (product.product_variants ?? []).filter((v) => !v.deleted_at)

  if (variants.length === 0) {
    return (
      <tr className="bg-[#F8FAFC]">
        <td colSpan={5} className="px-4 py-3 text-sm text-[#6B7280]">
          No sellable variants loaded. Open the product to manage variants.
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-[#FFF1F2]/60">
      <td colSpan={5} className="px-4 py-3">
        <div className="overflow-x-auto rounded-lg border border-[#FECDD3] bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[#FFF1F2] text-[#9F1239]">
              <tr>
                <th className="px-3 py-2 font-semibold">Variant</th>
                <th className="px-3 py-2 font-semibold">SKU</th>
                <th className="px-3 py-2 font-semibold">Barcode</th>
                <th className="px-3 py-2 font-semibold">Price</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-[#111111]">{v.name ?? '—'}</td>
                  <td className="px-3 py-2 text-[#6B7280]">{v.sku ?? '—'}</td>
                  <td className="px-3 py-2 text-[#6B7280]">{v.barcode ?? '—'}</td>
                  <td className="px-3 py-2">{formatBDT(Number(v.selling_price ?? 0))}</td>
                  <td className="px-3 py-2">Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}
