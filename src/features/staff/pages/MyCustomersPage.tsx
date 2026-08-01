import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Phone } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { EmptyState } from '@/components/shared/EmptyState'
import { CustomerRatingStars } from '@/features/customer-rating'
import { listMyAssignedCustomers } from '../repositories/staff.repository'

export function MyCustomersPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['staff-my-customers'],
    queryFn: () => listMyAssignedCustomers(50),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Customers</h1>
        <p className="text-sm text-[#6B7280]">আপনার Assigned Customer তালিকা</p>
      </div>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">{(error as Error).message}</p> : null}

      {data.length === 0 && !isLoading ? (
        <EmptyState
          title="Assigned Customer নেই"
          description="Admin Customer Assignment দিলে এখানে দেখাবে। আপনি তৈরি করা Customer-ও Follow-up-এ যোগ করতে পারেন।"
        />
      ) : (
        <ul className="space-y-2">
          {data.map((c) => (
            <li key={c.id} className="rounded-2xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link to={`/customers/${c.id}`} className="text-base font-semibold text-[#111827]">
                    {c.name}
                  </Link>
                  <div className="mt-1">
                    <CustomerRatingStars score={c.rating_score} size="sm" />
                  </div>
                </div>
                {c.phone ? (
                  <div className="flex gap-2">
                    <a
                      href={`tel:${c.phone}`}
                      className="inline-flex h-10 items-center gap-1 rounded-xl bg-[#F3F4F6] px-3 text-sm"
                    >
                      <Phone className="h-4 w-4" /> Call
                    </a>
                    <a
                      href={`https://wa.me/88${c.phone.replace(/\D/g, '').slice(-11)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center rounded-xl bg-[#25D366]/15 px-3 text-sm text-[#128C7E]"
                    >
                      WhatsApp
                    </a>
                  </div>
                ) : null}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-[#6B7280]">Current Due</dt>
                  <dd className="font-medium">{formatBDT(Number(c.current_due))}</dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Last purchase</dt>
                  <dd className="font-medium">
                    {c.last_purchase_at
                      ? new Date(c.last_purchase_at).toLocaleDateString()
                      : '—'}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/staff/follow-ups`}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                >
                  Set Follow-up
                </Link>
                <Link
                  to="/moderator/orders/new"
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                >
                  Create Order
                </Link>
                <Link
                  to={`/customers/${c.id}/ledger`}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                >
                  Ledger
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
