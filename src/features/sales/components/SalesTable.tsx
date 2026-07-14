import { Link } from 'react-router-dom'
import {
  Copy,
  Eye,
  FileText,
  Gift,
  MoreHorizontal,
  Pencil,
  Printer,
  Share2,
  Tag,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react'
import type { SaleListRow } from '@/services/sales.service'
import { formatBDT, formatDateShort } from '@/lib/format'
import { SaleStatusBadge } from './SaleStatusBadge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface SaleRowActions {
  onView: (id: string) => void
  onEdit: (id: string) => void
  onPrint: (id: string, type: 'a4' | 'pos' | 'gift-label') => void
  onPayment: (id: string) => void
  onReturn: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onShare: (id: string) => void
}

interface SalesTableProps {
  rows: SaleListRow[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  actions: SaleRowActions
  sortKey: string
  sortDir: 'asc' | 'desc'
  onSort: (key: string) => void
  hiddenColumns: Set<string>
}

const COLUMNS = [
  { key: 'saleNo', label: 'Invoice' },
  { key: 'customerName', label: 'Customer' },
  { key: 'branchName', label: 'Branch' },
  { key: 'salespersonName', label: 'Salesperson' },
  { key: 'channel', label: 'Channel' },
  { key: 'total', label: 'Total' },
  { key: 'paidAmount', label: 'Paid' },
  { key: 'dueAmount', label: 'Due' },
  { key: 'status', label: 'Status' },
] as const

export function SalesTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  actions,
  sortKey,
  sortDir,
  onSort,
  hiddenColumns,
}: SalesTableProps) {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm md:block">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[#F8F6F2] text-left text-[11px] uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="w-10 px-3 py-3">
                <Checkbox checked={allSelected} onCheckedChange={() => onToggleAll()} aria-label="Select all" />
              </th>
              {COLUMNS.filter((c) => !hiddenColumns.has(c.key)).map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none px-3 py-3 hover:text-[#111111]"
                  onClick={() => onSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-[#F1F5F9] transition hover:bg-[#F8F6F2]/60',
                  row.deleted_at && 'opacity-50',
                )}
              >
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => onToggle(row.id)}
                    aria-label={`Select ${row.saleNo}`}
                  />
                </td>
                {!hiddenColumns.has('saleNo') && (
                  <td className="px-3 py-2.5">
                    <Link to={`/sales/${row.id}`} className="font-semibold text-[#E11D48] hover:underline">
                      {row.saleNo}
                    </Link>
                    <p className="text-[11px] text-[#6B7280]">{formatDateShort(row.created_at)}</p>
                  </td>
                )}
                {!hiddenColumns.has('customerName') && (
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{row.customerName}</p>
                    <p className="text-[11px] text-[#6B7280]">{row.customerPhone}</p>
                  </td>
                )}
                {!hiddenColumns.has('branchName') && <td className="px-3 py-2.5">{row.branchName}</td>}
                {!hiddenColumns.has('salespersonName') && (
                  <td className="px-3 py-2.5">{row.salespersonName}</td>
                )}
                {!hiddenColumns.has('channel') && <td className="px-3 py-2.5">{row.channel}</td>}
                {!hiddenColumns.has('total') && (
                  <td className="px-3 py-2.5 font-semibold">{formatBDT(row.total)}</td>
                )}
                {!hiddenColumns.has('paidAmount') && (
                  <td className="px-3 py-2.5 text-emerald-700">{formatBDT(row.paidAmount)}</td>
                )}
                {!hiddenColumns.has('dueAmount') && (
                  <td className="px-3 py-2.5 text-amber-700">{formatBDT(row.dueAmount)}</td>
                )}
                {!hiddenColumns.has('status') && (
                  <td className="px-3 py-2.5">
                    <SaleStatusBadge status={row.status} />
                  </td>
                )}
                <td className="px-3 py-2.5 text-right">
                  <RowMenu row={row} actions={actions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RowMenu({ row, actions }: { row: SaleListRow; actions: SaleRowActions }) {
  const disabled = !!row.deleted_at
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => actions.onView(row.id)}>
          <Eye className="mr-2 h-3.5 w-3.5" /> View
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onClick={() => actions.onEdit(row.id)}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onPrint(row.id, 'a4')}>
          <Printer className="mr-2 h-3.5 w-3.5" /> Print A4
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onPrint(row.id, 'a4')}>
          <FileText className="mr-2 h-3.5 w-3.5" /> Invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onPrint(row.id, 'pos')}>
          <Tag className="mr-2 h-3.5 w-3.5" /> POS Label
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onPrint(row.id, 'gift-label')}>
          <Gift className="mr-2 h-3.5 w-3.5" /> Gift Label
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onShare(row.id)}>
          <Share2 className="mr-2 h-3.5 w-3.5" /> Share
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled || row.dueAmount <= 0} onClick={() => actions.onPayment(row.id)}>
          <Wallet className="mr-2 h-3.5 w-3.5" /> Receive Payment
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled || row.status === 'Returned'} onClick={() => actions.onReturn(row.id)}>
          <Undo2 className="mr-2 h-3.5 w-3.5" /> Return Sale
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onDuplicate(row.id)}>
          <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disabled}
          className="text-red-600 focus:text-red-600"
          onClick={() => actions.onDelete(row.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { COLUMNS }
