import { formatBDT } from '@/lib/format'

type Props = {
  name: string
  productTypeLabel: string
  categoryLabel: string | null
  brandLabel: string | null
  baseSku: string
  baseBarcode: string
  variantCount: number
  purchasePrice: number
  sellingPrice: number
  totalOpeningQty: number
  stepHint?: string
}

export function ProductSummaryPanel({
  name,
  productTypeLabel,
  categoryLabel,
  brandLabel,
  baseSku,
  baseBarcode,
  variantCount,
  purchasePrice,
  sellingPrice,
  totalOpeningQty,
  stepHint,
}: Props) {
  const rows: Array<[string, string]> = [
    ['Type', productTypeLabel || '—'],
    ['Category', categoryLabel || '—'],
    ['Brand', brandLabel || '—'],
    ['Base SKU', baseSku || '—'],
    ['Barcode', baseBarcode || '—'],
    ['Variants', String(Math.max(1, variantCount))],
    ['Purchase', formatBDT(purchasePrice)],
    ['Retail', formatBDT(sellingPrice)],
    ['Opening stock', `${totalOpeningQty} pcs`],
  ]

  return (
    <aside className="product-module rounded-2xl border border-[#FECDD3] bg-white p-4 shadow-sm lg:sticky lg:top-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#E11D48]">Product summary</p>
      <h3 className="mt-1 font-serif text-lg text-[#111111]">{name.trim() || 'Untitled product'}</h3>
      {stepHint ? <p className="mt-1 text-xs text-[#6B7280]">{stepHint}</p> : null}
      <dl className="mt-4 space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 text-sm">
            <dt className="text-[#6B7280]">{label}</dt>
            <dd className="max-w-[60%] truncate text-right font-medium text-[#111111]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-xl bg-[#FFF1F2] px-3 py-2 text-xs text-[#9F1239]">
        Completing required fields unlocks activation for POS.
      </div>
    </aside>
  )
}
