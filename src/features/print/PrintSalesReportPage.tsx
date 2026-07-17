import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { formatBDT } from '@/lib/format'
import {
  exportSalesHistory,
  getSalesHistoryKpis,
} from '@/features/sales/repositories/sales.repository'
import { filtersFromSearchParams } from '@/features/sales/schemas/sale-filters.schema'
import { formatCategoryChips } from '@/features/sales/schemas/sale-filters.schema'
import { printService } from './print.service'

export function PrintSalesReportPage() {
  const [searchParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams])

  const reportQuery = useQuery({
    queryKey: ['print', 'sales-report', filters],
    queryFn: async () => {
      const [rows, kpis] = await Promise.all([
        exportSalesHistory(filters),
        getSalesHistoryKpis(filters),
      ])
      return { rows, kpis }
    },
  })

  useEffect(() => {
    document.title = 'Sales Report'
  }, [])

  if (reportQuery.isLoading) return <LoadingSkeleton rows={12} height="h-12" />
  if (reportQuery.isError || !reportQuery.data) {
    return (
      <EmptyState
        title="Unable to load sales report"
        description="Check filters or try again from Sales history."
      />
    )
  }

  const { rows, kpis } = reportQuery.data
  const criteria = [
    filters.preset !== 'all' ? `Period: ${filters.preset}` : 'Period: all',
    filters.fromDate || filters.toDate
      ? `Dates: ${filters.fromDate ?? '…'} → ${filters.toDate ?? '…'}`
      : null,
    filters.branchId ? 'Branch filtered' : null,
    filters.customerId ? 'Customer filtered' : null,
    filters.cashierId ? 'Cashier filtered' : null,
    filters.status ? `Status: ${filters.status}` : null,
    filters.paymentStatus ? `Payment: ${filters.paymentStatus}` : null,
    filters.paymentMethod ? `Method: ${filters.paymentMethod}` : null,
    filters.dueOnly ? 'Due only' : null,
    filters.search ? `Invoice search: ${filters.search}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <div className="no-print print-toolbar report-print-toolbar">
        <Link to="/sales">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sales
          </Button>
        </Link>
        <Button size="sm" onClick={() => printService.triggerPrint()}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
        <Button variant="purple" size="sm" onClick={() => printService.triggerPrint()}>
          <Download className="h-3.5 w-3.5" />
          Save as PDF
        </Button>
        <span className="report-print-toolbar-title">Sales Report</span>
      </div>

      <div className="report-print-page">
        <header className="report-header">
          <div className="report-brand">
            <div className="report-logo">GB</div>
            <div>
              <p className="report-company">Sales History Report</p>
              <p className="report-powered">Powered by Code Bondhu IT</p>
            </div>
          </div>
          <div className="report-title-block">
            <h1 className="report-title">Filtered Sales</h1>
            <p className="report-meta-line">
              <span>Generated:</span> {new Date().toLocaleString()}
            </p>
            <p className="report-meta-line">
              <span>Rows:</span> {rows.total}
            </p>
          </div>
        </header>

        <div className="report-criteria">{criteria || 'No additional filters'}</div>

        <section className="report-section">
          <h2 className="report-section-title">Summary</h2>
          <div className="report-summary-grid">
            <div className="report-kpi-box">
              <span className="report-kpi-label">Total Sales</span>
              <span className="report-kpi-value">{formatBDT(kpis.total_sales)}</span>
            </div>
            <div className="report-kpi-box">
              <span className="report-kpi-label">Paid</span>
              <span className="report-kpi-value">{formatBDT(kpis.total_paid)}</span>
            </div>
            <div className="report-kpi-box">
              <span className="report-kpi-label">Due</span>
              <span className="report-kpi-value">{formatBDT(kpis.total_due)}</span>
            </div>
            <div className="report-kpi-box">
              <span className="report-kpi-label">Discount</span>
              <span className="report-kpi-value">{formatBDT(kpis.total_discount)}</span>
            </div>
            <div className="report-kpi-box">
              <span className="report-kpi-label">Invoices</span>
              <span className="report-kpi-value">{kpis.total_invoices}</span>
            </div>
            <div className="report-kpi-box">
              <span className="report-kpi-label">Items Sold</span>
              <span className="report-kpi-value">{kpis.total_items_sold}</span>
            </div>
          </div>
        </section>

        <section className="report-table-section">
          <h2 className="report-section-title">Invoices</h2>
          {rows.items.length === 0 ? (
            <div className="report-empty">No sales match these filters.</div>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>Invoice</th>
                  <th style={{ width: '16%' }}>Customer</th>
                  <th style={{ width: '18%' }}>Items</th>
                  <th style={{ width: '12%' }}>Branch</th>
                  <th style={{ width: '10%' }}>Total</th>
                  <th style={{ width: '10%' }}>Paid</th>
                  <th style={{ width: '10%' }}>Due</th>
                  <th style={{ width: '10%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="report-cell">
                        <span className="report-cell-title">{row.invoice_no}</span>
                        <span className="report-cell-sub">
                          {new Date(row.sale_at).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="report-cell">
                        <span className="report-cell-title">{row.customer_name ?? 'Walk-in'}</span>
                        <span className="report-cell-sub">{row.customer_phone ?? ''}</span>
                      </div>
                    </td>
                    <td>
                      <div className="report-cell">
                        <span className="report-cell-title">{row.item_qty} items</span>
                        <span className="report-cell-sub">
                          {formatCategoryChips(row.category_summary, 2)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="report-cell">
                        <span className="report-cell-title">{row.branch_name ?? '—'}</span>
                        <span className="report-cell-sub">{row.cashier_name ?? ''}</span>
                      </div>
                    </td>
                    <td>{formatBDT(row.grand_total)}</td>
                    <td>{formatBDT(row.paid_total)}</td>
                    <td>{formatBDT(row.due_total)}</td>
                    <td>
                      <div className="report-cell">
                        <span className="report-cell-status">{row.status}</span>
                        <span className="report-cell-sub">{row.payment_status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="report-row-count">{rows.items.length} of {rows.total} rows shown</p>
        </section>

        <footer className="report-footer">
          <div className="report-footer-row">
            <span>Confidential — for internal use</span>
            <span className="report-page-num" />
          </div>
          <p className="report-footer-note">Powered by Code Bondhu IT</p>
        </footer>
      </div>
    </>
  )
}
