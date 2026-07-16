import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, Loader2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { createProductAtomic } from '../repositories/catalog.repository'

type Step = 'template' | 'upload' | 'preview' | 'validate' | 'import' | 'summary'

type ImportRow = {
  rowNum: number
  name: string
  category: string
  brand: string
  sku: string
  barcode: string
  purchase_price: number
  selling_price: number
  opening_stock: number
  errors: string[]
}

const CSV_HEADERS = [
  'name',
  'category',
  'brand',
  'sku',
  'barcode',
  'purchase_price',
  'selling_price',
  'opening_stock',
]

const TEMPLATE_CSV = `${CSV_HEADERS.join(',')}\nSample Product,Skincare,Brand A,SKU-001,8901234567890,100,150,10`

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell.trim())
      if (row.some((c) => c.length > 0)) rows.push(row)
      row = []
      cell = ''
      if (ch === '\r') i++
    } else {
      cell += ch
    }
  }

  if (cell.length || row.length) {
    row.push(cell.trim())
    if (row.some((c) => c.length > 0)) rows.push(row)
  }

  return rows
}

function rowsToImport(parsed: string[][]): ImportRow[] {
  if (parsed.length < 2) return []
  const header = parsed[0].map((h) => h.toLowerCase())
  const idx = (key: string) => header.indexOf(key)

  return parsed.slice(1).map((cells, i) => {
    const get = (key: string) => cells[idx(key)] ?? ''
    const purchase = Number(get('purchase_price')) || 0
    const selling = Number(get('selling_price')) || 0
    const stock = Number(get('opening_stock')) || 0
    const errors: string[] = []
    const name = get('name').trim()
    if (!name) errors.push('Name is required')
    if (purchase < 0) errors.push('Invalid purchase price')
    if (selling < 0) errors.push('Invalid selling price')
    if (stock < 0) errors.push('Invalid opening stock')

    return {
      rowNum: i + 2,
      name,
      category: get('category').trim(),
      brand: get('brand').trim(),
      sku: get('sku').trim(),
      barcode: get('barcode').trim(),
      purchase_price: purchase,
      selling_price: selling,
      opening_stock: stock,
      errors,
    }
  })
}

function validateRows(rows: ImportRow[]): ImportRow[] {
  return rows.map((r) => {
    const errors = [...r.errors]
    if (r.name.length > 200) errors.push('Name too long')
    return { ...r, errors }
  })
}

const CHUNK_SIZE = 10

export function ProductImportPage() {
  const { profile, activeBranchId } = useAuth()
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('template')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [imported, setImported] = useState(0)
  const [failed, setFailed] = useState<Array<{ rowNum: number; error: string }>>([])

  const validRows = useMemo(() => rows.filter((r) => r.errors.length === 0), [rows])
  const invalidCount = rows.length - validRows.length

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!activeBranchId) throw new Error('Select a branch first')
      let ok = 0
      const errors: Array<{ rowNum: number; error: string }> = []

      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE)
        await Promise.all(
          chunk.map(async (row) => {
            try {
              const payload: Record<string, unknown> = {
                name: row.name,
                base_sku: row.sku || null,
                base_barcode: row.barcode || null,
                purchase_price: row.purchase_price,
                selling_price: row.selling_price,
                status: 'draft',
                has_variants: false,
              }
              if (row.opening_stock > 0) {
                payload.opening_stock = [
                  {
                    branch_id: activeBranchId,
                    quantity: row.opening_stock,
                    unit_cost: row.purchase_price,
                  },
                ]
              }
              await createProductAtomic(payload)
              ok++
            } catch (e) {
              errors.push({
                rowNum: row.rowNum,
                error: e instanceof Error ? e.message : 'Import failed',
              })
            }
          }),
        )
      }

      return { ok, errors }
    },
    onSuccess: ({ ok, errors }) => {
      setImported(ok)
      setFailed(errors)
      setStep('summary')
      toast(`Imported ${ok} product${ok === 1 ? '' : 's'}`)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    const mapped = rowsToImport(parsed)
    setRows(mapped)
    setStep('preview')
  }

  const handleValidate = () => {
    setRows(validateRows(rows))
    setStep('validate')
  }

  return (
    <PermissionGate permission="products.import">
      <div className="mx-auto w-full max-w-4xl min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#111111]">Import products</h1>
            <p className="text-sm text-[#6B7280]">Upload a CSV file to bulk-create products.</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to="/products">Back to products</Link>
          </Button>
        </div>

        <ol className="flex flex-wrap gap-2 text-xs">
          {(['template', 'upload', 'preview', 'validate', 'import', 'summary'] as Step[]).map((s) => (
            <li
              key={s}
              className={
                step === s
                  ? 'rounded-full bg-[#111111] px-3 py-1 font-medium text-white'
                  : 'rounded-full bg-slate-100 px-3 py-1 text-[#6B7280]'
              }
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </li>
          ))}
        </ol>

        {step === 'template' ? (
          <div className="rounded-xl border border-border bg-white p-6 space-y-4">
            <p className="text-sm text-[#6B7280]">
              Download the CSV template, fill in your products, then upload in the next step.
            </p>
            <Button
              type="button"
              onClick={() => {
                const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'product-import-template.csv'
                a.click()
                URL.revokeObjectURL(url)
                setStep('upload')
              }}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download template
            </Button>
          </div>
        ) : null}

        {step === 'upload' ? (
          <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
            <Upload className="mx-auto h-8 w-8 text-[#6B7280]" />
            <p className="mt-2 text-sm text-[#6B7280]">Select a CSV file to upload</p>
            <InputFile onFile={handleFile} className="mt-4" />
          </div>
        ) : null}

        {(step === 'preview' || step === 'validate') && rows.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Purchase</TableHead>
                    <TableHead>Selling</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row) => (
                    <TableRow key={row.rowNum}>
                      <TableCell>{row.rowNum}</TableCell>
                      <TableCell>{row.name || '—'}</TableCell>
                      <TableCell>{row.sku || '—'}</TableCell>
                      <TableCell>{row.purchase_price}</TableCell>
                      <TableCell>{row.selling_price}</TableCell>
                      <TableCell>{row.opening_stock}</TableCell>
                      <TableCell className={row.errors.length ? 'text-[#E11D48]' : 'text-green-700'}>
                        {row.errors.length ? row.errors.join('; ') : 'OK'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 ? (
                <p className="p-3 text-xs text-[#6B7280]">Showing first 50 of {rows.length} rows.</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {step === 'preview' ? (
                <Button type="button" onClick={handleValidate}>
                  Validate
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={validRows.length === 0 || !activeBranchId || importMutation.isPending}
                  onClick={() => {
                    setStep('import')
                    importMutation.mutate()
                  }}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Import ${validRows.length} products`
                  )}
                </Button>
              )}
            </div>
            {step === 'validate' && invalidCount > 0 ? (
              <p className="text-sm text-[#E11D48]">{invalidCount} row(s) have errors and will be skipped.</p>
            ) : null}
            {!activeBranchId ? (
              <p className="text-sm text-[#E11D48]">Select an active branch for opening stock.</p>
            ) : null}
          </div>
        ) : null}

        {step === 'import' && importMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Importing products…
          </div>
        ) : null}

        {step === 'summary' ? (
          <div className="rounded-xl border border-border bg-white p-6 space-y-3">
            <p className="text-lg font-semibold text-[#111111]">Import complete</p>
            <p className="text-sm text-[#6B7280]">
              Successfully imported {imported} product{imported === 1 ? '' : 's'}.
              {failed.length > 0 ? ` ${failed.length} failed.` : ''}
            </p>
            {failed.length > 0 ? (
              <ul className="text-sm text-[#E11D48]">
                {failed.map((f) => (
                  <li key={f.rowNum}>
                    Row {f.rowNum}: {f.error}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button type="button" asChild>
              <Link to="/products">View products</Link>
            </Button>
          </div>
        ) : null}

        {!profile?.organization_id ? (
          <p className="text-sm text-[#E11D48]">Sign in to import products.</p>
        ) : null}
      </div>
    </PermissionGate>
  )
}

function InputFile({ onFile, className }: { onFile: (f: File) => void; className?: string }) {
  return (
    <label className={className}>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
      <span className="inline-flex cursor-pointer items-center rounded-xl bg-[#111111] px-4 py-2 text-sm font-medium text-white">
        Choose CSV file
      </span>
    </label>
  )
}
