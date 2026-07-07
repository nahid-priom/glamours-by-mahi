import { GroupedReportCell } from '@/components/reports/GroupedReportCell'
import type { ReportPrintDocument } from '@/features/reports/report-print.service'

interface PrintReportA4Props {
  document: ReportPrintDocument
}

export function PrintReportA4({ document: doc }: PrintReportA4Props) {
  const { title, summary, columns, rows, meta } = doc

  return (
    <div className="print-page report-print-page">
      <header className="report-header report-section">
        <div className="report-brand">
          <div className="report-logo">R</div>
          <div>
            <p className="report-company">{meta.companyName}</p>
            <p className="report-powered">Powered by {meta.poweredBy}</p>
          </div>
        </div>
        <div className="report-title-block">
          <h1 className="report-title">{title}</h1>
          <p className="report-meta-line">
            <span>Generated:</span> {meta.generatedAt}
          </p>
          <p className="report-meta-line">
            <span>Period:</span> {meta.periodLabel}
          </p>
        </div>
      </header>

      {meta.filterLabels.length > 0 && (
        <section className="report-criteria report-section">
          <strong>Report Criteria:</strong>{' '}
          {meta.filterLabels.join(' · ')}
        </section>
      )}

      <section className="report-section">
        <div className="report-summary-grid">
          {summary.map((item) => (
            <div key={item.label} className="report-kpi-box">
              <span className="report-kpi-label">{item.label}</span>
              <span className="report-kpi-value">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="report-section report-table-section">
        <h2 className="report-section-title">Detailed Records</h2>
        {rows.length === 0 ? (
          <p className="report-empty">No records match the selected criteria.</p>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <GroupedReportCell {...(row[col.key] ?? {})} variant="print" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="report-row-count">
          Total records: {rows.length.toLocaleString('en-BD')}
        </p>
      </section>

      <footer className="report-footer report-section">
        <div className="report-footer-row">
          <span>Prepared by SMART ORDER MS OMS (System Generated)</span>
          <span className="report-page-num" />
        </div>
        <div className="report-signature-line">
          Authorized Signature: _________________________________
        </div>
        <p className="report-footer-note">Printed from SMART ORDER MS Order Management System</p>
      </footer>
    </div>
  )
}
