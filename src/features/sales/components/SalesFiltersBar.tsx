import { peekDatabase } from '@/database/transaction'
import { Input } from '@/components/ui/input'
import type { SaleListFilters } from '@/services/sales.service'

interface SalesFiltersBarProps {
  filters: SaleListFilters
  onChange: (next: SaleListFilters) => void
}

export function SalesFiltersBar({ filters, onChange }: SalesFiltersBarProps) {
  const db = peekDatabase()
  const set = <K extends keyof SaleListFilters>(key: K, value: SaleListFilters[K]) =>
    onChange({ ...filters, [key]: value })

  const selectClass =
    'h-9 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#111111] outline-none focus:border-[#E11D48]/40'

  return (
    <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => set('from', e.target.value || undefined)}
          className="h-9 rounded-xl"
          aria-label="From date"
        />
        <Input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => set('to', e.target.value || undefined)}
          className="h-9 rounded-xl"
          aria-label="To date"
        />
        <select
          className={selectClass}
          value={filters.branchId ?? 'all'}
          onChange={(e) => set('branchId', e.target.value)}
        >
          <option value="all">All Branches</option>
          {db.branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={filters.channel ?? 'all'}
          onChange={(e) => set('channel', e.target.value)}
        >
          <option value="all">All Channels</option>
          {['Physical Shop', 'Website', 'Facebook', 'WhatsApp', 'Phone Order', 'Marketplace'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={filters.salespersonId ?? 'all'}
          onChange={(e) => set('salespersonId', e.target.value)}
        >
          <option value="all">All Salespeople</option>
          {db.employees.slice(0, 20).map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={filters.paymentStatus ?? 'all'}
          onChange={(e) => set('paymentStatus', e.target.value)}
        >
          <option value="all">Payment Status</option>
          <option value="paid">Fully Paid</option>
          <option value="partial">Partial Paid</option>
          <option value="due">Outstanding</option>
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <select
          className={selectClass}
          value={filters.deliveryStatus ?? 'all'}
          onChange={(e) => set('deliveryStatus', e.target.value)}
        >
          <option value="all">Delivery Status</option>
          <option value="Pickup">Pickup</option>
          <option value="Home Delivery">Home Delivery</option>
          <option value="Courier">Courier</option>
        </select>
        <Input
          placeholder="Invoice No"
          value={filters.invoiceNo ?? ''}
          onChange={(e) => set('invoiceNo', e.target.value || undefined)}
          className="h-9 rounded-xl"
        />
        <Input
          type="number"
          placeholder="Min amount"
          value={filters.amountMin ?? ''}
          onChange={(e) => set('amountMin', e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 rounded-xl"
        />
        <Input
          type="number"
          placeholder="Max amount"
          value={filters.amountMax ?? ''}
          onChange={(e) => set('amountMax', e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 rounded-xl"
        />
        <Input
          placeholder="Search customer, invoice…"
          value={filters.search ?? ''}
          onChange={(e) => set('search', e.target.value || undefined)}
          className="h-9 rounded-xl sm:col-span-2"
        />
      </div>
    </div>
  )
}
