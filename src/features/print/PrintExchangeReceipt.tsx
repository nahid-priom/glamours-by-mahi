import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { formatBDT, formatDate } from '@/lib/format'
import { supabase } from '@/lib/supabase/client'

/**
 * Printable exchange receipt — read-only projection of completed exchange.
 * No financial mutations.
 */
export function PrintExchangeReceiptPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['print-exchange', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data: row, error: qError } = await (supabase as any)
        .from('exchanges')
        .select(
          `
          id, exchange_no, status, difference_amount, note, created_at, sale_id, branch_id,
          sales(invoice_no, customers(name, phone)),
          branches(name)
        `,
        )
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      if (qError) throw qError
      if (!row) throw new Error('Exchange not found')
      return row as {
        exchange_no: string
        status: string
        difference_amount: number
        note: string | null
        created_at: string
        sales?: { invoice_no: string; customers?: { name: string; phone: string } | null } | null
        branches?: { name: string } | null
      }
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return <p className="p-6 text-sm text-danger">{(error as Error)?.message ?? 'Not found'}</p>
  }

  const customer = data.sales?.customers

  return (
    <div className="print-page mx-auto max-w-lg p-6 text-sm">
      <header className="mb-4 border-b pb-3">
        <p className="text-xs uppercase tracking-widest text-text-muted">Exchange receipt</p>
        <h1 className="text-xl font-bold">{data.exchange_no}</h1>
        <p className="text-text-muted">{formatDate(data.created_at)}</p>
      </header>
      <dl className="space-y-2">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Status</dt>
          <dd className="font-medium">{data.status}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Original invoice</dt>
          <dd className="font-medium">{data.sales?.invoice_no ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Branch</dt>
          <dd>{data.branches?.name ?? '—'}</dd>
        </div>
        {customer ? (
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Customer</dt>
            <dd>
              {customer.name}
              {customer.phone ? ` · ${customer.phone}` : ''}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
          <dt>Difference</dt>
          <dd>{formatBDT(Number(data.difference_amount))}</dd>
        </div>
      </dl>
      {data.note ? <p className="mt-4 text-text-muted">Note: {data.note}</p> : null}
    </div>
  )
}
