import { useParams } from 'react-router-dom'
import { formatBDT } from '@/lib/format'
import { peekDatabase } from '@/database/transaction'
import {
  AccountsOverviewPage,
  ErpSimpleListPage,
  InventoryBranchStockPage,
  InventoryLedgerPage,
  InventoryLowStockPage,
  ModuleShell,
  SupplierDetailsPage,
  SuppliersListPage,
} from './ErpModulePages'
import {
  SalesListPage,
  SaleDetailsPage,
  SaleEditPage,
  SaleReturnPage,
  SaleCollectionPage,
} from '@/features/sales/SalesPages'
import { SalesPosPage } from '@/features/sales/SalesPosPage'
import {
  SalesReportsHubPage,
  SalesReportChannelsPage,
  SalesReportProductsPage,
  SalesReportCustomersPage,
  SalesReportCollectionsPage,
  SalesReportProfitPage,
  SalesReportReturnsPage,
  SalesReportSalespersonPage,
} from '@/features/sales/SalesReportsPages'
import { PurchaseNewFormPage } from './PurchaseNewFormPage'
import { TransferNewFormPage } from './TransferNewFormPage'
import { CollectionFormPage } from './CollectionFormPage'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { resetDatabase, getDatabase } from '@/database/local-database'
import { useToast } from '@/components/ui/toast'
import { useQueryClient } from '@tanstack/react-query'
import { payrollService } from '@/services/payroll.service'
import { courierService } from '@/services/courier.service'
import { erpOrdersService } from '@/services/erp-orders.service'
import { inventoryService } from '@/services/inventory.service'
import { useAuth } from '@/features/auth/auth.context'
import { ERP_DB_KEY } from '@/database/schema'

export {
  SalesPosPage,
  SalesListPage,
  SaleDetailsPage,
  SaleEditPage,
  SaleReturnPage,
  SaleCollectionPage,
  SalesReportsHubPage,
  SalesReportChannelsPage,
  SalesReportProductsPage,
  SalesReportCustomersPage,
  SalesReportCollectionsPage,
  SalesReportProfitPage,
  SalesReportReturnsPage,
  SalesReportSalespersonPage,
  AccountsOverviewPage,
  InventoryBranchStockPage,
  InventoryLedgerPage,
  InventoryLowStockPage,
  SuppliersListPage,
  SupplierDetailsPage,
}

export function SaleDetailsRoute() {
  return <SaleDetailsPage />
}

export function SaleEditRoute() {
  return <SaleEditPage />
}

export function SaleReturnRoute() {
  return <SaleReturnPage />
}

export function SaleCollectionRoute() {
  return <SaleCollectionPage />
}

export function SalesReturnsPage() {
  const rows = peekDatabase().saleReturns.map((r) => ({
    id: r.id,
    primary: r.saleId,
    secondary: r.reason,
    meta: formatBDT(r.total),
  }))
  return <ErpSimpleListPage title="Sales Returns" subtitle="Returned sales" rows={rows} />
}

export function SalesCollectionsPage() {
  return <CollectionFormPage />
}

export function SalesCommissionsPage() {
  const db = peekDatabase()
  const rows = db.commissions.map((c) => ({
    id: c.id,
    primary: db.employees.find((e) => e.id === c.employeeId)?.name ?? c.employeeId,
    secondary: `${c.status} · Sale ${c.saleId}`,
    meta: formatBDT(c.amount),
  }))
  return <ErpSimpleListPage title="Commissions" subtitle="Salesperson commission board" rows={rows} />
}

export function PurchasesListPage() {
  const db = peekDatabase()
  const rows = db.purchases.map((p) => ({
    id: p.id,
    primary: p.purchaseNo,
    secondary: db.suppliers.find((s) => s.id === p.supplierId)?.name,
    meta: formatBDT(p.total),
  }))
  return (
    <ModuleShell title="Purchases" action={<Link to="/purchases/new"><Button className="rounded-full">New Purchase</Button></Link>}>
      <div className="space-y-2">
        {rows.map((r) => (
          <Link key={r.id} to={`/purchases/${r.id}`} className="block rounded-2xl border bg-white px-4 py-3 hover:border-[#E11D48]/40">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.primary}</p>
                {r.secondary && <p className="text-xs text-[#6B7280]">{r.secondary}</p>}
              </div>
              <p className="shrink-0 text-sm font-semibold">{r.meta}</p>
            </div>
          </Link>
        ))}
      </div>
    </ModuleShell>
  )
}

export function PurchaseDetailsPage() {
  const { id } = useParams()
  const db = peekDatabase()
  const purchase = db.purchases.find((p) => p.id === id)
  if (!purchase) {
    return (
      <ModuleShell title="Purchase">
        <p className="text-sm text-[#6B7280]">Purchase not found.</p>
      </ModuleShell>
    )
  }
  const supplier = db.suppliers.find((s) => s.id === purchase.supplierId)
  return (
    <ModuleShell title={purchase.purchaseNo} subtitle={supplier?.name}>
      <div className="space-y-3 rounded-2xl border bg-white p-4 text-sm">
        <div className="flex justify-between"><span>Total</span><span className="font-semibold">{formatBDT(purchase.total)}</span></div>
        <div className="flex justify-between"><span>Paid</span><span>{formatBDT(purchase.paidAmount)}</span></div>
        <div className="flex justify-between"><span>Due — Current Balance</span><span>{formatBDT(purchase.dueAmount)}</span></div>
        <div className="border-t pt-3">
          {purchase.items.map((i) => {
            const product = db.products.find((p) => p.id === i.productId)
            return (
              <div key={i.productId} className="flex justify-between py-1">
                <span>{product?.name ?? i.productId} × {i.quantity}</span>
                <span>{formatBDT(i.total)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </ModuleShell>
  )
}

export function PurchasePlaceholderPage({ title }: { title: string }) {
  if (title === 'New Purchase') return <PurchaseNewFormPage />
  const db = peekDatabase()
  if (title === 'Purchase Returns') {
    const rows = db.purchaseReturns.map((r) => ({
      id: r.id,
      primary: r.purchaseId,
      secondary: r.reason,
      meta: formatBDT(r.total),
    }))
    return <ErpSimpleListPage title="Purchase Returns" rows={rows} />
  }
  return (
    <ModuleShell title={title} subtitle="Connected purchase workflow">
      <div className="rounded-2xl border bg-white p-6 text-sm text-[#6B7280]">
        Purchase saved records appear in the purchases list. Stock and supplier due update automatically on save.
      </div>
      <Link to="/purchases" className="mt-4 inline-block text-sm font-semibold text-[#E11D48]">
        Back to purchases
      </Link>
    </ModuleShell>
  )
}

export { PurchaseNewFormPage, TransferNewFormPage }

export function HrEmployeesPage() {
  const rows = peekDatabase().employees.map((e) => ({
    id: e.id,
    primary: e.name,
    secondary: `${e.designation} · ${e.department}`,
    meta: formatBDT(e.basicSalary),
  }))
  return <ErpSimpleListPage title="Employees" subtitle="HR directory" rows={rows} />
}

export function HrAttendancePage() {
  const db = peekDatabase()
  const rows = db.attendance.slice(0, 60).map((a) => ({
    id: a.id,
    primary: db.employees.find((e) => e.id === a.employeeId)?.name ?? a.employeeId,
    secondary: `${a.date} · ${a.source}`,
    meta: a.status,
  }))
  return <ErpSimpleListPage title="Attendance" subtitle="Biometric + manual attendance" rows={rows} />
}

export function HrLeavesPage() {
  const db = peekDatabase()
  const rows = db.leaves.map((l) => ({
    id: l.id,
    primary: db.employees.find((e) => e.id === l.employeeId)?.name ?? l.employeeId,
    secondary: `${l.fromDate} → ${l.toDate} · ${l.type}`,
    meta: l.status,
  }))
  return <ErpSimpleListPage title="Leave" rows={rows} />
}

export function HrPayrollPage() {
  const db = peekDatabase()
  const { session } = useAuth()
  const { toast } = useToast()
  const accountId = db.financialAccounts.find((a) => a.type === 'Bank')?.id ?? db.financialAccounts[0]?.id

  return (
    <ModuleShell title="Payroll" subtitle="Basic + overtime + commission − deductions = Net Salary">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          className="rounded-full"
          onClick={() => {
            const month = new Date().toISOString().slice(0, 7)
            payrollService.generateMonth(month, session.name)
            toast('Payroll generated')
            window.location.reload()
          }}
        >
          Generate This Month
        </Button>
      </div>
      <div className="space-y-2">
        {db.payrolls.map((p) => {
          const name = db.employees.find((e) => e.id === p.employeeId)?.name ?? p.employeeId
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                <p className="text-xs text-[#6B7280]">
                  {p.month} · {p.status}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="text-sm font-semibold">{formatBDT(p.netSalary)}</p>
                {p.status !== 'Paid' && accountId && (
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      try {
                        payrollService.pay({ payrollId: p.id, accountId, userName: session.name })
                        toast('Payroll payment completed')
                        window.location.reload()
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Payment failed', 'error')
                      }
                    }}
                  >
                    Pay
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ModuleShell>
  )
}

export function ReportsSalesPage() {
  return <SalesReportsHubPage />
}

export function CourierSettlementsPage() {
  const rows = peekDatabase().courierSettlements.map((c) => ({
    id: c.id,
    primary: c.courierName,
    secondary: `COD ${formatBDT(c.codAmount)} · Charge ${formatBDT(c.courierCharge)}`,
    meta: c.status,
  }))
  return <ErpSimpleListPage title="Courier Settlements" rows={rows} />
}

export function CourierReturnsPage() {
  const rows = peekDatabase().courierBookings
    .filter((c) => c.status === 'Returned' || c.status === 'Failed')
    .map((c) => ({
      id: c.id,
      primary: c.consignmentId,
      secondary: c.courierName,
      meta: c.status,
    }))
  return <ErpSimpleListPage title="Courier Returns" rows={rows} />
}

export function TransfersListPage() {
  const db = peekDatabase()
  const { session } = useAuth()
  const { toast } = useToast()
  return (
    <ModuleShell
      title="Stock Transfers"
      action={
        <Link to="/inventory/transfers/new">
          <Button className="rounded-full">New Transfer</Button>
        </Link>
      }
    >
      <div className="space-y-2">
        {db.stockTransfers.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3">
            <div>
              <p className="font-medium">{t.transferNo}</p>
              <p className="text-xs text-[#6B7280]">
                {t.status} · {t.items.length} items
              </p>
            </div>
            {t.status === 'Dispatched' && (
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  try {
                    inventoryService.receive(t.id, session.name)
                    toast('Stock transfer received')
                    window.location.reload()
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Receive failed', 'error')
                  }
                }}
              >
                Receive
              </Button>
            )}
          </div>
        ))}
      </div>
    </ModuleShell>
  )
}

export function TransferNewPage() {
  return <TransferNewFormPage />
}

export function DemoControlPanel() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { session } = useAuth()

  const reset = () => {
    if (!confirm('Reset all demo ERP data? This cannot be undone.')) return
    resetDatabase()
    queryClient.clear()
    toast('Demo data restored successfully')
    window.location.reload()
  }

  const exportBackup = () => {
    const raw = localStorage.getItem(ERP_DB_KEY)
    const blob = new Blob([raw ?? '{}'], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'glamourous-by-mahi-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    toast('Backup exported')
  }

  const importBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      localStorage.setItem(ERP_DB_KEY, text)
      getDatabase()
      queryClient.clear()
      toast('Backup imported')
      window.location.reload()
    }
    input.click()
  }

  return (
    <ModuleShell title="Demo Control Center" subtitle="Presentation tools for Glamourous by Mahi">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="rounded-full" onClick={reset}>
          Reset Demo Data
        </Button>
        <Button variant="outline" className="rounded-full" onClick={reset}>
          Restore Default Data
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            const db = peekDatabase()
            const order = db.orders.find((o) => o.status === 'New' || o.status === 'Confirmed')
            if (order) {
              courierService.book({ orderId: order.id, userName: session.name })
              toast('Courier booking simulated')
            } else toast('No ready order found', 'error')
          }}
        >
          Simulate Courier Status
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            erpOrdersService.createFromWebsite({
              customerName: 'Demo Website Customer',
              phone: '01711' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0'),
              address: 'Bashundhara City, Dhaka',
              district: 'Dhaka',
              deliveryCharge: 80,
              items: peekDatabase()
                .products.slice(0, 2)
                .map((p) => ({
                  productId: p.id,
                  name: p.name,
                  sku: p.sku,
                  quantity: 1,
                  unitPrice: p.salePrice ?? p.price,
                })),
            })
            toast('Website order simulated')
          }}
        >
          Simulate Website Orders
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            payrollService.generateMonth(new Date().toISOString().slice(0, 7), session.name)
            toast('Payroll generated')
          }}
        >
          Generate Payroll
        </Button>
        <Button variant="outline" className="rounded-full" onClick={exportBackup}>
          Export Backup JSON
        </Button>
        <Button variant="outline" className="rounded-full" onClick={importBackup}>
          Import Backup JSON
        </Button>
      </div>
    </ModuleShell>
  )
}

export function AccountsSubPage({ title, filter }: { title: string; filter?: 'Income' | 'Expense' | 'Cash' | 'Bank' | 'Mobile' }) {
  const db = peekDatabase()
  if (filter === 'Cash' || filter === 'Bank' || filter === 'Mobile') {
    const type = filter === 'Mobile' ? 'Mobile Banking' : filter
    const rows = db.financialAccounts
      .filter((a) => a.type === type)
      .map((a) => ({ id: a.id, primary: a.name, meta: formatBDT(a.balance) }))
    return <ErpSimpleListPage title={title} rows={rows} />
  }
  if (filter === 'Income' || filter === 'Expense') {
    const rows = db.financialTransactions
      .filter((t) => t.type === filter)
      .slice(0, 80)
      .map((t) => ({ id: t.id, primary: t.description, secondary: t.category, meta: formatBDT(t.amount) }))
    return <ErpSimpleListPage title={title} rows={rows} />
  }
  if (title.includes('Customer Due')) {
    const rows = db.customers
      .filter((c) => c.currentDue > 0)
      .map((c) => ({ id: c.id, primary: c.name, secondary: c.phone, meta: formatBDT(c.currentDue) }))
    return <ErpSimpleListPage title={title} rows={rows} />
  }
  if (title.includes('Supplier Due')) {
    const rows = db.suppliers.map((s) => {
      const due = db.purchases.filter((p) => p.supplierId === s.id).reduce((sum, p) => sum + p.dueAmount, 0)
      return { id: s.id, primary: s.name, secondary: s.phone, meta: formatBDT(due) }
    }).filter((r) => r.meta !== formatBDT(0))
    return <ErpSimpleListPage title={title} rows={rows} />
  }
  return <AccountsOverviewPage />
}
