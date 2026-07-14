import { Link, useParams } from 'react-router-dom'
import { formatBDT } from '@/lib/format'
import { peekDatabase } from '@/database/transaction'
import { Button } from '@/components/ui/button'

export function ModuleShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#111111]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function InventoryBranchStockPage() {
  const db = peekDatabase()
  const rows = db.stockBalances.slice(0, 80).map((b) => {
    const product = db.products.find((p) => p.id === b.productId)
    const branch = db.branches.find((br) => br.id === b.branchId)
    return { ...b, productName: product?.name ?? '', branchName: branch?.name ?? '', sku: product?.sku ?? '' }
  })
  return (
    <ModuleShell title="Branch Stock" subtitle="Available quantity by branch">
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F8F6F2] text-left text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Reserved</th>
              <th className="px-4 py-3">Available</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-3">{r.productName}</td>
                <td className="px-4 py-3">{r.branchName}</td>
                <td className="px-4 py-3">{r.quantity}</td>
                <td className="px-4 py-3">{r.reserved}</td>
                <td className="px-4 py-3 font-semibold">{r.quantity - r.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModuleShell>
  )
}

export function InventoryLowStockPage() {
  const db = peekDatabase()
  const rows = db.stockBalances
    .filter((b) => b.quantity - b.reserved <= db.settings.lowStockThreshold)
    .map((b) => {
      const product = db.products.find((p) => p.id === b.productId)
      const branch = db.branches.find((br) => br.id === b.branchId)
      return { ...b, productName: product?.name ?? '', branchName: branch?.name ?? '' }
    })
  return (
    <ModuleShell title="Low Stock" subtitle={`Threshold: ${db.settings.lowStockThreshold}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-white p-4">
            <p className="font-medium">{r.productName}</p>
            <p className="text-xs text-[#6B7280]">{r.branchName}</p>
            <p className="mt-2 text-lg font-semibold text-[#E11D48]">{r.quantity - r.reserved} left</p>
          </div>
        ))}
      </div>
    </ModuleShell>
  )
}

export function InventoryLedgerPage() {
  const db = peekDatabase()
  return (
    <ModuleShell title="Stock Ledger" subtitle="Recent stock movements">
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F8F6F2] text-left text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {db.stockMovements.slice(0, 100).map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3">{m.type}</td>
                <td className="px-4 py-3">{db.products.find((p) => p.id === m.productId)?.name}</td>
                <td className="px-4 py-3">{db.branches.find((b) => b.id === m.branchId)?.name}</td>
                <td className="px-4 py-3">{m.quantity}</td>
                <td className="px-4 py-3 text-xs">{m.referenceType}:{m.referenceId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModuleShell>
  )
}

export function SuppliersListPage() {
  const db = peekDatabase()
  const rows = db.suppliers.map((s) => {
    const purchases = db.purchases.filter((p) => p.supplierId === s.id)
    const paid = db.supplierPayments.filter((p) => p.supplierId === s.id).reduce((sum, p) => sum + p.amount, 0)
    const totalPurchase = purchases.reduce((sum, p) => sum + p.total, 0)
    const due = purchases.reduce((sum, p) => sum + p.dueAmount, 0)
    return { ...s, totalPurchase, paid, due, products: new Set(purchases.flatMap((p) => p.items.map((i) => i.productId))).size }
  })
  return (
    <ModuleShell
      title="Suppliers"
      subtitle="Purchase, payment and due overview"
      action={<Link to="/suppliers/new"><Button className="rounded-full">Add Supplier</Button></Link>}
    >
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F8F6F2] text-left text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Total Purchase</th>
              <th className="px-4 py-3">Total Paid</th>
              <th className="px-4 py-3">Current Due</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.phone}</td>
                <td className="px-4 py-3">{s.products}</td>
                <td className="px-4 py-3">{formatBDT(s.totalPurchase)}</td>
                <td className="px-4 py-3">{formatBDT(s.paid)}</td>
                <td className="px-4 py-3 font-semibold text-[#E11D48]">{formatBDT(s.due)}</td>
                <td className="px-4 py-3"><Link className="text-[#E11D48]" to={`/suppliers/${s.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModuleShell>
  )
}

export function SupplierDetailsPage() {
  const { id } = useParams()
  const db = peekDatabase()
  const supplier = db.suppliers.find((s) => s.id === id)
  if (!supplier) return <p>Supplier not found</p>
  const purchases = db.purchases.filter((p) => p.supplierId === supplier.id)
  const payments = db.supplierPayments.filter((p) => p.supplierId === supplier.id)
  const totalPurchase = purchases.reduce((s, p) => s + p.total, 0)
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const due = purchases.reduce((s, p) => s + p.dueAmount, 0)

  return (
    <ModuleShell title={supplier.name} subtitle={supplier.phone}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Total Purchase', formatBDT(totalPurchase)],
          ['Total Paid', formatBDT(totalPaid)],
          ['Current Due', formatBDT(due)],
          ['Purchases', String(purchases.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-4">
            <p className="text-lg font-semibold">{value}</p>
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Purchases</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {purchases.slice(0, 10).map((p) => (
              <li key={p.id} className="flex justify-between border-t pt-2">
                <span>{p.purchaseNo}</span>
                <span>{formatBDT(p.total)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Ledger</h2>
          <p className="mt-1 text-xs text-[#6B7280]">Purchase / Debit · Payment / Credit · Balance = Current Due</p>
          <ul className="mt-3 space-y-2 text-sm">
            {purchases.slice(0, 5).map((p) => (
              <li key={p.id} className="flex justify-between border-t pt-2">
                <span>{p.purchaseNo} (Debit)</span>
                <span className="text-[#E11D48]">+{formatBDT(p.total)}</span>
              </li>
            ))}
            {payments.slice(0, 5).map((p) => (
              <li key={p.id} className="flex justify-between border-t pt-2">
                <span>{p.reference} (Credit)</span>
                <span className="text-emerald-600">-{formatBDT(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ModuleShell>
  )
}

export function AccountsOverviewPage() {
  const db = peekDatabase()
  const income = db.financialTransactions.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const expense = db.financialTransactions.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
  return (
    <ModuleShell title="Accounts Overview" subtitle="Cash, bank and mobile banking">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {db.financialAccounts.map((a) => (
          <div key={a.id} className="rounded-2xl border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">{a.type}</p>
            <p className="mt-1 font-medium">{a.name}</p>
            <p className="mt-2 text-xl font-semibold">{formatBDT(a.balance)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-[#6B7280]">Total Income</p>
          <p className="text-xl font-semibold text-emerald-600">{formatBDT(income)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-[#6B7280]">Total Expenses</p>
          <p className="text-xl font-semibold text-[#E11D48]">{formatBDT(expense)}</p>
        </div>
      </div>
    </ModuleShell>
  )
}

export function ErpSimpleListPage({
  title,
  subtitle,
  rows,
}: {
  title: string
  subtitle?: string
  rows: { id: string; primary: string; secondary?: string; meta?: string }[]
}) {
  return (
    <ModuleShell title={title} subtitle={subtitle}>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.primary}</p>
                {r.secondary && <p className="text-xs text-[#6B7280]">{r.secondary}</p>}
              </div>
              {r.meta && <p className="shrink-0 text-sm font-semibold">{r.meta}</p>}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-[#6B7280]">No records yet</div>
        )}
      </div>
    </ModuleShell>
  )
}
