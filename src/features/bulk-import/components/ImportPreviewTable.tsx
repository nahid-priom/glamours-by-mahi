import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import type { BulkImportAdapter, ImportPreviewRow, ImportRowAction } from '../types'

const ACTION_STYLES: Record<ImportRowAction, string> = {
  create: 'bg-emerald-50 text-emerald-800',
  update: 'bg-sky-50 text-sky-800',
  skip: 'bg-slate-100 text-slate-600',
  error: 'bg-rose-50 text-rose-700',
}

type Props = {
  adapter: BulkImportAdapter
  rows: ImportPreviewRow[]
  filter: 'all' | 'errors' | 'updates' | 'creates'
  onChangeRow: (rowNum: number, next: ImportPreviewRow) => void
}

export function ImportPreviewTable({ adapter, rows, filter, onChangeRow }: Props) {
  const visible = rows.filter((r) => {
    if (filter === 'errors') return r.action === 'error' || r.errors.length > 0
    if (filter === 'updates') return r.action === 'update'
    if (filter === 'creates') return r.action === 'create'
    return true
  })

  return (
    <div className="rounded-xl border border-border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Action</TableHead>
            {adapter.columns.map((c) => (
              <TableHead key={c.key}>{c.label}</TableHead>
            ))}
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.slice(0, 200).map((row) => (
            <TableRow key={row.rowNum}>
              <TableCell className="align-top text-xs text-[#6B7280]">{row.rowNum}</TableCell>
              <TableCell className="align-top">
                <select
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${ACTION_STYLES[row.action]}`}
                  value={row.action}
                  onChange={(e) => {
                    const action = e.target.value as ImportRowAction
                    onChangeRow(row.rowNum, adapter.revalidateRow({ ...row, action }))
                  }}
                >
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="skip">Skip</option>
                  <option value="error">Error</option>
                </select>
              </TableCell>
              {adapter.columns.map((c) => (
                <TableCell key={c.key} className="align-top min-w-[7rem]">
                  <Input
                    className="h-8 text-xs"
                    value={row.values[c.key] ?? ''}
                    onChange={(e) => {
                      const values = { ...row.values, [c.key]: e.target.value }
                      onChangeRow(row.rowNum, adapter.revalidateRow({ ...row, values }))
                    }}
                  />
                </TableCell>
              ))}
              <TableCell className="align-top text-xs max-w-[14rem]">
                {row.errors.length ? (
                  <span className="text-rose-600">{row.errors.join('; ')}</span>
                ) : (
                  <span className="text-[#6B7280]">
                    {[...row.diff, ...row.notes].join(' · ') || '—'}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {visible.length > 200 ? (
        <p className="p-3 text-xs text-[#6B7280]">Showing first 200 of {visible.length} filtered rows.</p>
      ) : null}
      {visible.length === 0 ? (
        <p className="p-6 text-sm text-[#6B7280]">No rows match this filter.</p>
      ) : null}
    </div>
  )
}
