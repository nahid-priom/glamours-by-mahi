import { supabase } from '@/lib/supabase/client'
import type { ImportEntityType, ImportMatch, ImportPreviewRow } from '../types'

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

const db = supabase as unknown as RpcClient

export async function lookupProductsForImport(
  skus: string[],
  barcodes: string[],
): Promise<ImportMatch[]> {
  const { data, error } = await db.rpc('lookup_products_for_import', {
    p_skus: skus,
    p_barcodes: barcodes,
  })
  if (error) throw new Error(error.message)
  return normalizeMatches(data)
}

export async function lookupCustomersForImport(
  phones: string[],
  barcodes: string[],
): Promise<ImportMatch[]> {
  const { data, error } = await db.rpc('lookup_customers_for_import', {
    p_phones: phones,
    p_barcodes: barcodes,
  })
  if (error) throw new Error(error.message)
  return normalizeMatches(data)
}

export async function lookupSuppliersForImport(
  names: string[],
  barcodes: string[],
): Promise<ImportMatch[]> {
  const { data, error } = await db.rpc('lookup_suppliers_for_import', {
    p_names: names,
    p_barcodes: barcodes,
  })
  if (error) throw new Error(error.message)
  return normalizeMatches(data)
}

function normalizeMatches(data: unknown): ImportMatch[] {
  if (!Array.isArray(data)) return []
  return data.map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      matchKey: String(r.match_key ?? ''),
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
    }
  })
}

export async function createImportJob(input: {
  organizationId: string
  entityType: ImportEntityType
  filename: string
  mode?: string
  totalRows: number
}): Promise<string> {
  const { data, error } = await db.rpc('create_import_job', {
    p_entity_type: input.entityType,
    p_filename: input.filename,
    p_mode: input.mode ?? 'create_or_update',
    p_total_rows: input.totalRows,
  })
  if (error) throw new Error(error.message)
  return String(data)
}

export async function upsertImportJobRows(
  jobId: string,
  rows: ImportPreviewRow[],
): Promise<void> {
  const payload = rows.map((r) => ({
    row_num: r.rowNum,
    action: r.action,
    match_key: r.matchKey || null,
    existing_id: r.existingId,
    payload: r.values,
    errors: r.errors,
    status: r.action === 'error' ? 'invalid' : 'pending',
  }))
  const { error } = await db.rpc('upsert_import_job_rows', {
    p_job_id: jobId,
    p_rows: payload,
  })
  if (error) throw new Error(error.message)
}

export async function markImportJobRow(
  jobId: string,
  rowNum: number,
  status: 'success' | 'failed' | 'skipped',
  result?: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  const { error } = await db.rpc('mark_import_job_row', {
    p_job_id: jobId,
    p_row_num: rowNum,
    p_status: status,
    p_result: result ?? {},
    p_error: errorMessage ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function finalizeImportJob(
  jobId: string,
  summary: Record<string, unknown>,
  status: 'completed' | 'failed' = 'completed',
): Promise<void> {
  const { error } = await db.rpc('finalize_import_job', {
    p_job_id: jobId,
    p_summary: summary,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}
