import { useSearchParams } from 'react-router-dom'
import { MySalesPage } from './MySalesPage'

/** Online/moderator order lifecycle — not a duplicate of all POS sales. */
export function MyOrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">My Orders</h1>
        <p className="text-sm text-[#6B7280]">
          Online / ecommerce / moderator fulfilment only — POS walk-in sales stay under My Sales
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {['', 'pending_approval', 'approved', 'delivered', 'cancelled'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === s ? 'border-[#E11D48] bg-[#FFF1F2] text-[#E11D48]' : 'border-border bg-white'
            }`}
            onClick={() => {
              const next = new URLSearchParams(params)
              if (s) next.set('status', s)
              else next.delete('status')
              next.set('page', '1')
              setParams(next, { replace: true })
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <MySalesPage embedded orderOnly />
    </div>
  )
}
