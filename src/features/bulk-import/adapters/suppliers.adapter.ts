import {
  createSupplier,
  updateSupplier,
  type SupplierInput,
} from '@/features/suppliers/repositories/suppliers.repository'
import { blankSafeMerge, describeDiff, markWithinFileDuplicates } from '../lib/diff'
import { cellAt, mapHeaders, normalizePhoneField } from '../lib/normalize'
import { lookupSuppliersForImport } from '../repositories/import.repository'
import type { BulkImportAdapter, ImportPreviewRow } from '../types'

const HEADERS = ['name', 'phone', 'email', 'address', 'barcode', 'notes', 'status'] as const

const ALIASES: Record<string, string[]> = {
  name: ['supplier_name', 'vendor', 'company'],
  phone: ['mobile', 'cell', 'phone_number', 'contact'],
  email: ['email_address', 'mail'],
  address: ['addr'],
  barcode: ['supplier_barcode', 'code'],
  notes: ['note', 'remark', 'remarks'],
  status: ['supplier_status'],
}

function validateSupplierRow(row: ImportPreviewRow): ImportPreviewRow {
  const errors: string[] = []
  const name = row.values.name?.trim() ?? ''
  if (!name) errors.push('Name is required')
  const status = (row.values.status || 'active').toLowerCase()
  if (row.values.status && !['active', 'inactive'].includes(status)) {
    errors.push('Status must be active or inactive')
  }
  if (errors.length) return { ...row, action: 'error', errors, diff: [] }
  if (row.action === 'error') {
    return { ...row, action: row.existingId ? 'update' : 'create', errors: [] }
  }
  return { ...row, errors: [] }
}

export const suppliersAdapter: BulkImportAdapter = {
  entityType: 'suppliers',
  title: 'Import suppliers',
  description: 'Upload a CSV, merge by name, then confirm creates and updates.',
  listPath: '/suppliers',
  permission: 'suppliers.import',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'status', label: 'Status' },
  ],
  templateHeaders: [...HEADERS],
  templateSample: [
    'Sample Supplier',
    '01712345678',
    'vendor@email.com',
    'Dhaka',
    '',
    '',
    'active',
  ],
  columnGuide: [
    'Match key: supplier name (case-insensitive), then barcode.',
    'Blank cells on update leave existing values unchanged.',
  ],
  headerAliases: ALIASES,
  parseRows(matrix) {
    if (matrix.length < 2) return []
    const idx = mapHeaders(matrix[0], [...HEADERS], ALIASES)
    const rows = matrix.slice(1).map((cells, i) => {
      const values: Record<string, string> = {}
      for (const key of HEADERS) values[key] = cellAt(cells, idx[key])
      if (values.phone) values.phone = normalizePhoneField(values.phone) ?? values.phone
      const matchKey = values.name.trim().toLowerCase() || values.barcode.trim()
      return validateSupplierRow({
        rowNum: i + 2,
        action: 'create',
        matchKey,
        existingId: null,
        values,
        diff: [],
        errors: [],
        notes: [],
      })
    })
    return markWithinFileDuplicates(rows)
  },
  async enrichMatches(rows) {
    const names = rows.map((r) => r.values.name.trim()).filter(Boolean)
    const barcodes = rows.map((r) => r.values.barcode).filter(Boolean)
    let matches: Awaited<ReturnType<typeof lookupSuppliersForImport>> = []
    try {
      matches = await lookupSuppliersForImport(names, barcodes)
    } catch {
      matches = []
    }
    const byName = new Map<string, (typeof matches)[0]>()
    const byBarcode = new Map<string, (typeof matches)[0]>()
    for (const m of matches) {
      byName.set(String(m.matchKey).toLowerCase(), m)
      const barcode = String(m.snapshot.barcode ?? '')
      if (barcode) byBarcode.set(barcode, m)
    }

    return rows.map((row) => {
      if (row.action === 'error') return row
      const hit =
        byName.get(row.values.name.trim().toLowerCase()) ||
        (row.values.barcode && byBarcode.get(row.values.barcode)) ||
        null
      if (!hit) {
        return validateSupplierRow({ ...row, action: 'create', existingId: null, diff: [], notes: [] })
      }
      const snap = hit.snapshot
      const incoming: Record<string, unknown> = {
        name: row.values.name || undefined,
        phone: row.values.phone || undefined,
        email: row.values.email || undefined,
        address: row.values.address || undefined,
        barcode: row.values.barcode || undefined,
        notes: row.values.notes || undefined,
        status: row.values.status || undefined,
      }
      const patch = blankSafeMerge(snap, incoming)
      const diff = describeDiff(patch)
      if (diff.length === 0) {
        return validateSupplierRow({
          ...row,
          action: 'skip',
          existingId: hit.id,
          matchKey: String(hit.matchKey),
          diff: [],
          notes: ['No changes'],
        })
      }
      return validateSupplierRow({
        ...row,
        action: 'update',
        existingId: hit.id,
        matchKey: String(hit.matchKey),
        diff,
        notes: [],
      })
    })
  },
  revalidateRow(row) {
    const matchKey = row.values.name.trim().toLowerCase() || row.values.barcode.trim()
    return validateSupplierRow({ ...row, matchKey })
  },
  async commitRow(row, ctx) {
    if (row.action === 'skip' || row.action === 'error') return
    const status = (row.values.status || 'active').toLowerCase() as SupplierInput['status']
    const input: SupplierInput = {
      name: row.values.name.trim(),
      phone: row.values.phone.trim() || null,
      email: row.values.email.trim() || null,
      address: row.values.address.trim() || null,
      barcode: row.values.barcode.trim() || null,
      notes: row.values.notes.trim() || null,
      status: status === 'inactive' ? 'inactive' : 'active',
      branch_id: ctx.activeBranchId,
    }

    if (row.action === 'create') {
      await createSupplier(ctx.organizationId, input)
      return
    }

    if (row.action === 'update' && row.existingId) {
      const patch: Partial<SupplierInput> = {}
      if (row.values.name.trim()) patch.name = input.name
      if (row.values.phone.trim()) patch.phone = input.phone
      if (row.values.email.trim()) patch.email = input.email
      if (row.values.address.trim()) patch.address = input.address
      if (row.values.barcode.trim()) patch.barcode = input.barcode
      if (row.values.notes.trim()) patch.notes = input.notes
      if (row.values.status.trim()) patch.status = input.status
      await updateSupplier(row.existingId, patch)
    }
  },
}
