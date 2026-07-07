import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { GroupedReportCell } from '@/components/reports/GroupedReportCell'
import type { ReportResult } from '../reports.types'

export function ReportPreviewTable({ report }: { report: ReportResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{report.title} — Preview</CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden p-0">
        {report.rows.length === 0 ? (
          <EmptyState title="No data for this report" description="Adjust filters and generate again." />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full table-fixed text-sm" id="report-preview-table">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-left text-xs text-text-muted">
                    {report.columns.map((col) => (
                      <th key={col.key} className="px-4 py-3 font-semibold sm:px-5">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 align-top hover:bg-slate-50/50">
                      {report.columns.map((col) => (
                        <td key={col.key} className="px-4 py-3 sm:px-5">
                          <GroupedReportCell {...(row[col.key] ?? {})} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {report.rows.map((row, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-xl border border-border bg-white p-4"
                >
                  {report.columns.map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                      <span className="shrink-0 text-text-muted">{col.label}</span>
                      <GroupedReportCell {...(row[col.key] ?? {})} variant="inline" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
