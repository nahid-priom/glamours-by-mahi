import { Link } from 'react-router-dom'
import { ArrowLeftRight, Download, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'

type Props = {
  onExport: () => void
  exportDisabled?: boolean
}

export function InventoryPageHeader({ onExport, exportDisabled }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-[#111827]">Inventory Overview</h1>
      <div className="flex flex-wrap items-center gap-2">
        <PermissionGate permission="inventory.adjust">
          <Button asChild size="sm" className="h-9">
            <Link to="/inventory/adjustments">
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Adjust Stock
            </Link>
          </Button>
        </PermissionGate>
        <PermissionGate permission="inventory.transfer">
          <Button asChild size="sm" className="h-9">
            <Link to="/inventory/transfers/new">
              <ArrowLeftRight className="mr-1.5 h-4 w-4" />
              Transfer Stock
            </Link>
          </Button>
        </PermissionGate>
        <Button size="sm" variant="outline" className="h-9" onClick={onExport} disabled={exportDisabled}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>
  )
}
