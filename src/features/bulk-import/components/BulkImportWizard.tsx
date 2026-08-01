import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { downloadCsv } from '@/lib/format'
import { parseCsv, toCsv } from '../lib/parse-csv'
import {
  createImportJob,
  finalizeImportJob,
  markImportJobRow,
  upsertImportJobRows,
} from '../repositories/import.repository'
import type { BulkImportAdapter, ImportPreviewRow, ImportWizardStep } from '../types'
import { ImportPreviewTable } from './ImportPreviewTable'

const CHUNK_SIZE = 10
const STEPS: ImportWizardStep[] = ['template', 'upload', 'review', 'commit', 'summary']

type Props = {
  adapter: BulkImportAdapter
}

export function BulkImportWizard({ adapter }: Props) {
  const { profile, activeBranchId } = useAuth()
  const { toast } = useToast()
  const [step, setStep] = useState<ImportWizardStep>('template')
  const [filename, setFilename] = useState('import.csv')
  const [rows, setRows] = useState<ImportPreviewRow[]>([])
  const [filter, setFilter] = useState<'all' | 'errors' | 'updates' | 'creates'>('all')
  const [matching, setMatching] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imported, setImported] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [failed, setFailed] = useState<Array<{ rowNum: number; error: string }>>([])

  const counts = useMemo(() => {
    const create = rows.filter((r) => r.action === 'create').length
    const update = rows.filter((r) => r.action === 'update').length
    const skip = rows.filter((r) => r.action === 'skip').length
    const error = rows.filter((r) => r.action === 'error' || r.errors.length > 0).length
    return { create, update, skip, error }
  }, [rows])

  const commitEnabled =
    !committing &&
    !matching &&
    Boolean(profile?.organization_id) &&
    counts.error === 0 &&
    counts.create + counts.update > 0

  async function handleFile(file: File) {
    setFilename(file.name)
    const text = await file.text()
    const matrix = parseCsv(text)
    const parsed = adapter.parseRows(matrix)
    setRows(parsed)
    setStep('review')
    setMatching(true)
    try {
      const enriched = await adapter.enrichMatches(parsed)
      setRows(enriched)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Match failed', 'error')
    } finally {
      setMatching(false)
    }
  }

  async function handleCommit() {
    if (!profile?.organization_id) return
    setCommitting(true)
    setStep('commit')
    setProgress(0)
    setFailed([])

    const work = rows.filter((r) => r.action === 'create' || r.action === 'update')
    let jobId: string | null = null
    try {
      jobId = await createImportJob({
        organizationId: profile.organization_id,
        entityType: adapter.entityType,
        filename,
        totalRows: rows.length,
      })
      await upsertImportJobRows(jobId, rows)
    } catch {
      // Job audit is best-effort; commit still proceeds
      jobId = null
    }

    let ok = 0
    let skipCount = rows.filter((r) => r.action === 'skip').length
    const errors: Array<{ rowNum: number; error: string }> = []
    const ctx = {
      organizationId: profile.organization_id,
      activeBranchId,
      filename,
      jobId,
    }

    for (let i = 0; i < work.length; i += CHUNK_SIZE) {
      const chunk = work.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map(async (row) => {
          try {
            await adapter.commitRow(row, ctx)
            ok++
            if (jobId) await markImportJobRow(jobId, row.rowNum, 'success', { action: row.action })
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Import failed'
            errors.push({ rowNum: row.rowNum, error: message })
            if (jobId) await markImportJobRow(jobId, row.rowNum, 'failed', {}, message)
          }
        }),
      )
      setProgress(Math.min(100, Math.round(((i + chunk.length) / Math.max(work.length, 1)) * 100)))
    }

    for (const row of rows.filter((r) => r.action === 'skip')) {
      if (jobId) await markImportJobRow(jobId, row.rowNum, 'skipped')
    }

    if (jobId) {
      try {
        await finalizeImportJob(jobId, {
          ok,
          failed: errors.length,
          skipped: skipCount,
          filename,
        })
      } catch {
        /* ignore */
      }
    }

    setImported(ok)
    setSkipped(skipCount)
    setFailed(errors)
    setCommitting(false)
    setStep('summary')
    toast(`Imported ${ok} row${ok === 1 ? '' : 's'}`)
  }

  function downloadTemplate() {
    const csv = toCsv(adapter.templateHeaders, [adapter.templateSample])
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${adapter.entityType}-import-template.csv`
    a.click()
    URL.revokeObjectURL(url)
    setStep('upload')
  }

  function downloadFailures() {
    if (!failed.length) return
    const headers = ['row_num', 'error', ...adapter.templateHeaders]
    const body = failed.map((f) => {
      const row = rows.find((r) => r.rowNum === f.rowNum)
      return [f.rowNum, f.error, ...adapter.templateHeaders.map((h) => row?.values[h] ?? '')]
    })
    downloadCsv(`${adapter.entityType}-import-failures.csv`, headers, body)
  }

  return (
    <PermissionGate permission={adapter.permission}>
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#111111]">{adapter.title}</h1>
            <p className="text-sm text-[#6B7280]">{adapter.description}</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to={adapter.listPath}>Back to list</Link>
          </Button>
        </div>

        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s) => (
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
              Download the CSV template, fill rows, then upload. You will confirm matches before anything is saved.
            </p>
            <ul className="list-disc pl-5 text-sm text-[#6B7280] space-y-1">
              {adapter.columnGuide.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <Button type="button" onClick={downloadTemplate}>
              <Download className="mr-1.5 h-4 w-4" />
              Download template
            </Button>
          </div>
        ) : null}

        {step === 'upload' ? (
          <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
            <Upload className="mx-auto h-8 w-8 text-[#6B7280]" />
            <p className="mt-2 text-sm text-[#6B7280]">Select a CSV file to upload</p>
            <label className="mt-4 inline-flex cursor-pointer items-center rounded-xl bg-[#111111] px-4 py-2 text-sm font-medium text-white">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
              Choose CSV file
            </label>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="space-y-3">
            {matching ? (
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                <Loader2 className="h-4 w-4 animate-spin" /> Matching existing records…
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
                Create {counts.create}
              </span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-800">Update {counts.update}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Skip {counts.skip}</span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Errors {counts.error}</span>
              <div className="ml-auto flex gap-1">
                {(['all', 'creates', 'updates', 'errors'] as const).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    size="sm"
                    variant={filter === f ? 'default' : 'outline'}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>
            <ImportPreviewTable
              adapter={adapter}
              rows={rows}
              filter={filter}
              onChangeRow={(rowNum, next) => {
                setRows((prev) => prev.map((r) => (r.rowNum === rowNum ? next : r)))
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('upload')}>
                Re-upload
              </Button>
              <Button type="button" disabled={!commitEnabled} onClick={() => void handleCommit()}>
                Confirm import ({counts.create + counts.update})
              </Button>
            </div>
            {counts.error > 0 ? (
              <p className="text-sm text-rose-600">Fix or skip error rows before confirming.</p>
            ) : null}
            {adapter.entityType === 'products' && !activeBranchId ? (
              <p className="text-sm text-amber-700">
                No active branch selected — opening stock will be skipped on create.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'commit' ? (
          <div className="rounded-xl border border-border bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin" /> Committing rows… {progress}%
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-[#111111] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {step === 'summary' ? (
          <div className="rounded-xl border border-border bg-white p-6 space-y-3">
            <p className="text-lg font-semibold text-[#111111]">Import complete</p>
            <p className="text-sm text-[#6B7280]">
              Saved {imported} · skipped {skipped}
              {failed.length ? ` · failed ${failed.length}` : ''}.
            </p>
            {failed.length > 0 ? (
              <>
                <ul className="text-sm text-rose-600 max-h-40 overflow-auto">
                  {failed.map((f) => (
                    <li key={f.rowNum}>
                      Row {f.rowNum}: {f.error}
                    </li>
                  ))}
                </ul>
                <Button type="button" variant="outline" size="sm" onClick={downloadFailures}>
                  Download failed rows
                </Button>
              </>
            ) : null}
            <Button type="button" asChild>
              <Link to={adapter.listPath}>View list</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </PermissionGate>
  )
}
