import type { PrintSaleData } from './print.types'

export function PrintSaleGiftLabel({ sale }: { sale: PrintSaleData }) {
  return (
    <div className="print-page gift-label-page mx-auto max-w-sm space-y-3 p-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-500">{sale.storeName}</p>
      <p className="text-2xl font-bold">{sale.customerName}</p>
      <p className="text-sm">{sale.customerPhone}</p>
      <p className="text-sm text-slate-600">{sale.customerAddress}</p>
      <div className="my-4 border-t border-dashed border-slate-300" />
      <p className="font-mono text-sm font-semibold">Order {sale.saleNo}</p>
      <div className="mx-auto mt-3 flex h-16 w-48 items-end justify-center gap-0.5" aria-hidden>
        {sale.saleNo.split('').map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            className="inline-block bg-black"
            style={{ width: 3, height: 12 + ((ch.charCodeAt(0) + i) % 28) }}
          />
        ))}
      </div>
      <p className="font-mono text-[10px] tracking-widest">{sale.saleNo}</p>
      <div className="mx-auto mt-3 flex h-20 w-20 items-center justify-center border-2 border-black p-1">
        <div
          className="grid h-full w-full grid-cols-5 gap-px"
          style={{
            backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 21 21'><rect width='21' height='21' fill='white'/>${Array.from(
                { length: 21 },
                (_, y) =>
                  Array.from({ length: 21 }, (_, x) => {
                    const on = (x * 7 + y * 11 + sale.saleNo.length) % 3 === 0
                    return on ? `<rect x='${x}' y='${y}' width='1' height='1' fill='black'/>` : ''
                  }).join(''),
              ).join('')}</svg>`,
            )}")`,
            backgroundSize: 'cover',
          }}
        />
      </div>
      <p className="mt-4 text-sm text-slate-500">A gift for you</p>
    </div>
  )
}
