import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileSpreadsheet, Download, BarChart3 } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReportFiltersPanel } from './components/ReportFilters'
import { ReportSummaryCards } from './components/ReportSummaryCards'
import { ReportPreviewTable } from './components/ReportPreviewTable'
import { reportsService } from './reports.service'
import { buildReportPrintUrl } from './report-print.service'
import { flattenReportCell } from './report-cell.utils'
import type { ReportFilters, ReportResult, ReportType } from './reports.types'
import { downloadCsv } from '@/lib/format'
import { useToast } from '@/components/ui/toast'
import { toastRpcError } from '@/lib/errors/rpc-error'

const reportCards: { id: ReportType; title: string; description: string }[] = [
  { id: 'orders', title: 'Order Report', description: 'All orders with status breakdown' },
  { id: 'courier', title: 'Courier Report', description: 'Courier performance and delivery stats' },
  { id: 'store', title: 'Store Report', description: 'Store-wise orders and collection' },
  { id: 'collection', title: 'Collection Report', description: 'COD collection and payment summary' },
  { id: 'fraud', title: 'Fraud Report', description: 'Fraud risk orders and blocked customers' },
  { id: 'product_stock', title: 'Product Stock Report', description: 'Inventory levels and stock alerts' },
  { id: 'invoice', title: 'Invoice Report', description: 'Invoice status, amounts, and store breakdown' },
]

export function ReportsPage() {
  const { toast } = useToast()
  const previewRef = useRef<HTMLDivElement>(null)
  const [filters, setFilters] = useState<ReportFilters>(() => reportsService.getSavedFilters())
  const [activeReport, setActiveReport] = useState<ReportResult | null>(null)
  const [activeReportType, setActiveReportType] = useState<ReportType | null>(null)

  const generateMutation = useMutation({
    mutationFn: (type: ReportType) => reportsService.generateReport(type, filters),
    onSuccess: (data, type) => {
      setActiveReport(data)
      setActiveReportType(type)
      toast('Report generated')
      requestAnimationFrame(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const handleExportCsv = () => {
    if (!activeReport || activeReport.rows.length === 0) return
    const headers = activeReport.columns.map((c) => c.label)
    const rows = activeReport.rows.map((row) =>
      activeReport.columns.map((c) => flattenReportCell(row[c.key] ?? {})),
    )
    downloadCsv(`${activeReport.type}-report.csv`, headers, rows)
    toast('CSV downloaded')
  }

  const handleOpenPrint = () => {
    if (!activeReportType) return
    const url = buildReportPrintUrl(activeReportType, filters)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <PageShell title="Reports" description="Generate and export business reports">
      <ReportFiltersPanel filters={filters} onChange={setFilters} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="h-4 w-4 text-primary" />
                {report.title}
              </CardTitle>
              <p className="text-xs text-text-muted">{report.description}</p>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                onClick={() => generateMutation.mutate(report.id)}
                disabled={generateMutation.isPending}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeReport && (
        <div ref={previewRef} className="scroll-mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text">{activeReport.title}</h2>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button variant="purple" size="sm" onClick={handleOpenPrint}>
                <Download className="h-3.5 w-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </div>
          <ReportSummaryCards summary={activeReport.summary} />
          <ReportPreviewTable report={activeReport} />
        </div>
      )}
    </PageShell>
  )
}
