import { Link } from 'react-router-dom'
import { ArrowLeftRight, Download, Loader2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  onExportPage: () => void
  onExportAll: () => void
  exportDisabled?: boolean
  exportBusy?: boolean
}

export function InventoryPageHeader({
  onExportPage,
  onExportAll,
  exportDisabled,
  exportBusy,
}: Props) {
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-9" disabled={exportDisabled}>
              {exportBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Export CSV
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportPage}>Current page</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportAll}>All filtered results</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
