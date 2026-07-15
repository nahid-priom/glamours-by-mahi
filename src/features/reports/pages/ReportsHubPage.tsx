import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/reports/sales', title: 'Sales', desc: 'Completed sales by period' },
  { to: '/reports/purchases', title: 'Purchases', desc: 'Purchase invoices & totals' },
  { to: '/reports/inventory', title: 'Inventory', desc: 'On-hand balances by location' },
  { to: '/reports/customer-due', title: 'Customer due', desc: 'Outstanding receivables' },
  { to: '/reports/supplier-due', title: 'Supplier due', desc: 'Outstanding payables' },
  { to: '/reports/profit', title: 'Profit', desc: 'Revenue vs COGS' },
  { to: '/reports/branch', title: 'Branch', desc: 'Sales by branch' },
  { to: '/reports/salesperson', title: 'Salesperson', desc: 'Performance by staff' },
  { to: '/reports/product-performance', title: 'Product performance', desc: 'Top variants by revenue' },
  { to: '/reports/courier-returns', title: 'Courier returns', desc: 'Return request outcomes' },
]

export function ReportsHubPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Reports</h1>
        <p className="text-sm text-[#6B7280]">Supabase aggregations with date filters and CSV export.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-xl border border-border bg-white px-4 py-3 hover:border-[#E11D48]/40"
          >
            <p className="font-semibold text-[#111827]">{l.title}</p>
            <p className="text-xs text-[#6B7280]">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
