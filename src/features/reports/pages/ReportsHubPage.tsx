import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-session'
import { Input } from '@/components/ui/input'

type HubLink = {
  to: string
  title: string
  desc: string
  group: 'sales' | 'purchase' | 'finance' | 'logistics'
  /** Extra permission beyond reports.read (OR). */
  require?: ('accounts.read' | 'profit_loss.read')[]
}

const LINKS: HubLink[] = [
  {
    to: '/reports/sales',
    title: 'Sales',
    desc: 'Completed sales register by period (document authority)',
    group: 'sales',
  },
  {
    to: '/reports/branch',
    title: 'Branch',
    desc: 'Sales totals by original branch attribution',
    group: 'sales',
  },
  {
    to: '/reports/product-performance',
    title: 'Product performance',
    desc: 'Variants by revenue with historical COGS margin',
    group: 'sales',
  },
  {
    to: '/reports/salesperson',
    title: 'Salesperson',
    desc: 'Performance by attributed staff',
    group: 'sales',
  },
  {
    to: '/reports/top-customers',
    title: 'Top customers',
    desc: 'Ranked by rating and period spend',
    group: 'sales',
  },
  {
    to: '/reports/purchases',
    title: 'Purchases',
    desc: 'Completed purchase invoices (not OpEx)',
    group: 'purchase',
  },
  {
    to: '/reports/inventory',
    title: 'Inventory',
    desc: 'On-hand qty; WAC cost when permitted',
    group: 'purchase',
  },
  {
    to: '/reports/supplier-due',
    title: 'Supplier due',
    desc: 'Outstanding payables (party current_due)',
    group: 'purchase',
  },
  {
    to: '/reports/profit',
    title: 'Profit & Loss',
    desc: 'Canonical get_profit_loss_report (same as Accounts)',
    group: 'finance',
    require: ['accounts.read', 'profit_loss.read'],
  },
  {
    to: '/reports/customer-due',
    title: 'Customer due',
    desc: 'Outstanding receivables (party current_due)',
    group: 'finance',
  },
  {
    to: '/reports/dues',
    title: 'Due management',
    desc: 'Accounts dues hub with aging and actions',
    group: 'finance',
    require: ['accounts.read'],
  },
  {
    to: '/reports/cash-book',
    title: 'Cash book',
    desc: 'Financial transactions (Accounts cash-book authority)',
    group: 'finance',
    require: ['accounts.read'],
  },
  {
    to: '/reports/courier',
    title: 'Courier',
    desc: 'Parcels, COD, delivery rates and sync logs',
    group: 'logistics',
  },
  {
    to: '/reports/courier-returns',
    title: 'Courier returns',
    desc: 'Return request outcomes (ops — not auto sale returns)',
    group: 'logistics',
  },
]

const GROUP_LABEL: Record<HubLink['group'], string> = {
  sales: 'Sales & performance',
  purchase: 'Purchase & inventory',
  finance: 'Finance & accounting',
  logistics: 'Logistics',
}

export function ReportsHubPage() {
  const { can } = useAuth()
  const [q, setQ] = useState('')

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return LINKS.filter((l) => {
      if (l.require?.length && !can(l.require)) return false
      if (!needle) return true
      return (
        l.title.toLowerCase().includes(needle) ||
        l.desc.toLowerCase().includes(needle) ||
        GROUP_LABEL[l.group].toLowerCase().includes(needle)
      )
    })
  }, [can, q])

  const groups = (['sales', 'purchase', 'finance', 'logistics'] as const).filter((g) =>
    visible.some((l) => l.group === g),
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-[#111827]">Reports</h1>
        <p className="text-sm text-[#6B7280]">
          Operational documents and financial authorities — one calculation per metric. Sensitive
          finance tiles require Accounts permissions.
        </p>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reports…"
          className="max-w-md"
        />
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No reports match your search or permissions.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">
            {GROUP_LABEL[group]}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible
              .filter((l) => l.group === group)
              .map((l) => (
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
        </section>
      ))}
    </div>
  )
}
