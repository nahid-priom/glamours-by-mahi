import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'

type Props = {
  onExportCsv?: () => void
  onPrint?: () => void
  /** When false, cost/margin columns must already be excluded by caller. */
  exportingSensitive?: boolean
}

/**
 * Shared export/print controls. Callers must enforce the same filter contract
 * and omit unauthorized cost/payroll columns from CSV payloads.
 */
export function ReportExportMenu({ onExportCsv, onPrint }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {onPrint ? (
        <PermissionGate permission={['reports.print', 'reports.export']}>
          <Button size="sm" variant="outline" onClick={onPrint}>
            Print
          </Button>
        </PermissionGate>
      ) : null}
      {onExportCsv ? (
        <PermissionGate permission={['reports.export', 'reports.read']}>
          <Button size="sm" variant="outline" onClick={onExportCsv}>
            Export CSV
          </Button>
        </PermissionGate>
      ) : null}
    </div>
  )
}
