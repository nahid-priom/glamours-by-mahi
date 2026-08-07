import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT, formatDate } from '@/lib/format'
import { supabase } from '@/lib/supabase/client'

type PublicInvoiceDto = {
  invoice_no: string
  grand_total: number
  paid_total: number
  due_total: number
  completed_at: string | null
  status: string
  channel: string | null
  customer: { name: string; phone: string } | null
  items: Array<{
    id: string
    qty: number
    unit_price: number
    line_total: number
    name: string
    sku: string | null
  }>
}

/**
 * Public invoice view via random secure token (not a predictable sale UUID).
 * Uses SECURITY DEFINER RPC — anon cannot list sales by tokenless SELECT.
 */
export function PublicInvoicePage() {
  const { secureToken } = useParams<{ secureToken: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-invoice', secureToken],
    queryFn: async () => {
      if (!secureToken || secureToken.length < 16) {
        throw new Error('Invalid invoice link')
      }
      const { data: dto, error: rpcError } = await supabase.rpc(
        'get_public_invoice_by_token' as never,
        { p_token: secureToken } as never,
      )
      if (rpcError) throw rpcError
      if (!dto) throw new Error('Invoice not found or link expired')
      return dto as unknown as PublicInvoiceDto
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

  const customer = data.customer
  const items = data.items ?? []

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
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                {item.name}
                <span className="text-[#6B7280]"> × {item.qty}</span>
              </span>
              <span className="shrink-0 font-medium">{formatBDT(Number(item.line_total))}</span>
            </li>
          ))}
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
            <div className="flex justify-between text-[#6B7280]">
              <span>Due</span>
              <span>{formatBDT(Number(data.due_total))}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
