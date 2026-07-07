import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { printService } from './print.service'
import './print.css'

export function PrintLayout() {
  const location = useLocation()
  const isReportRoute = location.pathname.startsWith('/print/reports')

  return (
    <div className="print-root">
      {!isReportRoute && (
        <div className="no-print print-toolbar">
          <Link to="/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Orders
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
          <p className="print-hint no-print">
            Tip: Choose &quot;Save as PDF&quot; in the print dialog for a downloadable copy. Use 100mm × 150mm paper for thermal labels.
          </p>
        </div>
      )}
      <Outlet />
    </div>
  )
}
