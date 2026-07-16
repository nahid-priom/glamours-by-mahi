import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT, formatDate } from '@/lib/format'
import { supabase } from '@/lib/supabase/client'

/**
 * Public invoice view via random secure token (not a predictable sale UUID).
 * Tokens live on sales.public_share_token when issued from the ERP.
 */
export function PublicInvoicePage() {
  const { secureToken } = useParams<{ secureToken: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-invoice', secureToken],
    queryFn: async () => {
      if (!secureToken || secureToken.length < 16) {
        throw new Error('Invalid invoice link')
      }
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(
          `
          id, invoice_no, grand_total, paid_total, due_total, completed_at, status, channel,
          customers(name, phone),
          sale_items(id, qty, unit_price, line_total, product_variants(name, sku, products(name)))
        `,
        )
        .eq('public_share_token' as never, secureToken)
        .is('deleted_at', null)
        .maybeSingle()

      if (saleError) throw saleError
      if (!sale) throw new Error('Invoice not found or link expired')
      return sale
    },
    enabled: Boolean(secureToken),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#F8F6F2]">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-[#111111]">Invoice unavailable</h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          {(error as Error)?.message ?? 'This link is invalid or has been revoked.'}
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/">Back to shop</Link>
        </Button>
      </div>
    )
  }

  const customer = data.customers as { name: string; phone: string } | null
  const items = (data.sale_items as Array<{
    id: string
    qty: number
    unit_price: number
    line_total: number
    product_variants: {
      name: string | null
      sku: string
      products: { name: string } | null
    } | null
  }>) ?? []

  return (
    <div className="min-h-svh bg-[#F8F6F2] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#111111]/8 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6B7280]">
          Invoice
        </p>
        <h1 className="mt-1 font-serif text-2xl text-[#111111]">{data.invoice_no}</h1>
        {data.completed_at ? (
          <p className="mt-1 text-xs text-[#6B7280]">{formatDate(data.completed_at)}</p>
        ) : null}
        {customer ? (
          <p className="mt-4 text-sm text-[#111111]">
            {customer.name}
            <span className="text-[#6B7280]"> · {customer.phone}</span>
          </p>
        ) : null}

        <ul className="mt-6 space-y-3 border-t border-[#111111]/8 pt-4">
          {items.map((item) => {
            const name =
              item.product_variants?.products?.name ??
              item.product_variants?.name ??
              item.product_variants?.sku ??
              'Item'
            return (
              <li key={item.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  {name}
                  <span className="text-[#6B7280]"> × {item.qty}</span>
                </span>
                <span className="shrink-0 font-medium">{formatBDT(Number(item.line_total))}</span>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 space-y-1 border-t border-[#111111]/8 pt-4 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatBDT(Number(data.grand_total))}</span>
          </div>
          <div className="flex justify-between text-[#6B7280]">
            <span>Paid</span>
            <span>{formatBDT(Number(data.paid_total))}</span>
          </div>
          {Number(data.due_total) > 0 ? (
            <div className="flex justify-between text-[#E11D48]">
              <span>Due (COD)</span>
              <span>{formatBDT(Number(data.due_total))}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
