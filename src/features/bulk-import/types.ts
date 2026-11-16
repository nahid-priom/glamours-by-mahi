import type { Permission } from '@/lib/permissions'

export type ImportEntityType = 'products' | 'customers' | 'suppliers'

export type ImportRowAction = 'create' | 'update' | 'skip' | 'error'

export type ImportWizardStep = 'template' | 'upload' | 'review' | 'commit' | 'summary'

export type ImportMatch = {
  id: string
  matchKey: string
  snapshot: Record<string, unknown>
}

export type ImportPreviewRow = {
  rowNum: number
  action: ImportRowAction
  matchKey: string
  existingId: string | null
  /** Canonical field values (editable in UI). */
  values: Record<string, string>
  /** Human labels for changed fields on update. */
  diff: string[]
  errors: string[]
  notes: string[]
  resultError?: string
}

export type ImportColumn = {
  key: string
  label: string
  editable?: boolean
}

export type ImportCommitContext = {
  organizationId: string
  activeBranchId: string | null
  filename: string
  jobId: string | null
  /** All preview rows in this commit (for grouped variant product creates). */
  allRows?: ImportPreviewRow[]
  /** Mutable set of group keys already committed in this job. */
  committedGroupKeys?: Set<string>
}

export type ImportCommitResult = {
  ok: number
  failed: Array<{ rowNum: number; error: string }>
  skipped: number
}

export type BulkImportAdapter = {
  entityType: ImportEntityType
  title: string
  description: string
  listPath: string
  permission: Permission
  columns: ImportColumn[]
  templateHeaders: string[]
  templateSample: string[]
  columnGuide: string[]
  headerAliases: Record<string, string[]>
  parseRows: (matrix: string[][]) => ImportPreviewRow[]
  enrichMatches: (rows: ImportPreviewRow[]) => Promise<ImportPreviewRow[]>
  revalidateRow: (row: ImportPreviewRow) => ImportPreviewRow
  commitRow: (row: ImportPreviewRow, ctx: ImportCommitContext) => Promise<void>
}
