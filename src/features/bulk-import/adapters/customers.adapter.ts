import {
  createCustomer,
  updateCustomer,
  type CustomerInput,
} from '@/features/customers/repositories/customers.repository'
import { normalizeBdPhone } from '@/lib/phone-utils'
import { blankSafeMerge, describeDiff, markWithinFileDuplicates } from '../lib/diff'
import { cellAt, mapHeaders, normalizePhoneField } from '../lib/normalize'
import { lookupCustomersForImport } from '../repositories/import.repository'
import type { BulkImportAdapter, ImportPreviewRow } from '../types'

const HEADERS = [
  'name',
  'phone',
  'email',
  'address',
  'district',
  'barcode',
  'preferred_channel',
  'notes',
  'status',
] as const

const ALIASES: Record<string, string[]> = {
  name: ['customer_name', 'full_name', 'customer'],
  phone: ['mobile', 'cell', 'phone_number', 'contact'],
  email: ['email_address', 'mail'],
  address: ['addr', 'shipping_address'],
  district: ['city', 'area'],
  barcode: ['customer_barcode', 'code'],
  preferred_channel: ['channel', 'source'],
  notes: ['note', 'remark', 'remarks'],
  status: ['customer_status'],
}

function validateCustomerRow(row: ImportPreviewRow): ImportPreviewRow {
  const errors: string[] = []
  const name = row.values.name?.trim() ?? ''
  const phoneRaw = row.values.phone?.trim() ?? ''
  if (!name) errors.push('Name is required')
  if (!phoneRaw) errors.push('Phone is required')
  else {
    const normalized = normalizeBdPhone(phoneRaw)
    if (!normalized && phoneRaw.replace(/\D/g, '').length < 10) {
      errors.push('Invalid phone')
    }
  }
  const status = (row.values.status || 'active').toLowerCase()
  if (row.values.status && !['active', 'blocked', 'archived'].includes(status)) {
    errors.push('Status must be active, blocked, or archived')
  }
  if (errors.length) return { ...row, action: 'error', errors, diff: [] }
  if (row.action === 'error') {
    return { ...row, action: row.existingId ? 'update' : 'create', errors: [] }
  }
  return { ...row, errors: [] }
}

export const customersAdapter: BulkImportAdapter = {
  entityType: 'customers',
  title: 'Import customers',
  description: 'Upload a CSV, merge by phone, then confirm creates and updates.',
  listPath: '/customers',
  permission: 'customers.import',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'district', label: 'District' },
    { key: 'address', label: 'Address' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'status', label: 'Status' },
  ],
  templateHeaders: [...HEADERS],
  templateSample: [
    'Sample Customer',
    '01712345678',
    'sample@email.com',
    'House 1, Road 2',
    'Dhaka',
    '',
    'whatsapp',
    '',
    'active',
  ],
  columnGuide: [
    'Match key: normalized phone, then barcode.',
    'Blank cells on update leave existing values unchanged.',
    'Phones are normalized to 01XXXXXXXXX when possible.',
  ],
  headerAliases: ALIASES,
  parseRows(matrix) {
    if (matrix.length < 2) return []
    const idx = mapHeaders(matrix[0], [...HEADERS], ALIASES)
    const rows = matrix.slice(1).map((cells, i) => {
      const values: Record<string, string> = {}
      for (const key of HEADERS) values[key] = cellAt(cells, idx[key])
      const phone = normalizePhoneField(values.phone) ?? values.phone.trim()
      values.phone = phone
      const matchKey = phone || values.barcode.trim()
      return validateCustomerRow({
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
    const phones = rows.map((r) => r.values.phone).filter(Boolean)
    const barcodes = rows.map((r) => r.values.barcode).filter(Boolean)
    let matches: Awaited<ReturnType<typeof lookupCustomersForImport>> = []
    try {
      matches = await lookupCustomersForImport(phones, barcodes)
    } catch {
      matches = []
    }
    const byPhone = new Map<string, (typeof matches)[0]>()
    const byBarcode = new Map<string, (typeof matches)[0]>()
    for (const m of matches) {
      const phone = String(m.snapshot.phone ?? '')
      const barcode = String(m.snapshot.barcode ?? '')
      if (phone) byPhone.set(phone, m)
      if (barcode) byBarcode.set(barcode, m)
    }

    return rows.map((row) => {
      if (row.action === 'error') return row
      const hit =
        (row.values.phone && byPhone.get(row.values.phone)) ||
        (row.values.barcode && byBarcode.get(row.values.barcode)) ||
        null
      if (!hit) {
        return validateCustomerRow({ ...row, action: 'create', existingId: null, diff: [], notes: [] })
      }
      const snap = hit.snapshot
      const incoming: Record<string, unknown> = {
        name: row.values.name || undefined,
        phone: row.values.phone || undefined,
        email: row.values.email || undefined,
        address: row.values.address || undefined,
        district: row.values.district || undefined,
        barcode: row.values.barcode || undefined,
        preferred_channel: row.values.preferred_channel || undefined,
        notes: row.values.notes || undefined,
        status: row.values.status || undefined,
      }
      const patch = blankSafeMerge(snap, incoming)
      const diff = describeDiff(patch)
      if (diff.length === 0) {
        return validateCustomerRow({
          ...row,
          action: 'skip',
          existingId: hit.id,
          matchKey: String(snap.phone ?? row.matchKey),
          diff: [],
          notes: ['No changes'],
        })
      }
      return validateCustomerRow({
        ...row,
        action: 'update',
        existingId: hit.id,
        matchKey: String(snap.phone ?? row.matchKey),
        diff,
        notes: [],
      })
    })
  },
  revalidateRow(row) {
    const phone = normalizePhoneField(row.values.phone) ?? row.values.phone.trim()
    const values: Record<string, string> = { ...row.values, phone }
    const matchKey = phone || (values.barcode ?? '').trim()
    return validateCustomerRow({ ...row, values, matchKey })
  },
  async commitRow(row, ctx) {
    if (row.action === 'skip' || row.action === 'error') return
    const status = (row.values.status || 'active').toLowerCase() as CustomerInput['status']
    const input: CustomerInput = {
      name: row.values.name.trim(),
      phone: row.values.phone.trim(),
      email: row.values.email.trim() || null,
      address: row.values.address.trim() || null,
      district: row.values.district.trim() || null,
      barcode: row.values.barcode.trim() || null,
      preferred_channel: row.values.preferred_channel.trim() || null,
      notes: row.values.notes.trim() || null,
      status: ['active', 'blocked', 'archived'].includes(status ?? '') ? status : 'active',
      branch_id: ctx.activeBranchId,
    }

    if (row.action === 'create') {
      await createCustomer(ctx.organizationId, input)
      return
    }

    if (row.action === 'update' && row.existingId) {
      const patch: Partial<CustomerInput> = {}
      if (row.values.name.trim()) patch.name = input.name
      if (row.values.phone.trim()) patch.phone = input.phone
      if (row.values.email.trim()) patch.email = input.email
      if (row.values.address.trim()) patch.address = input.address
      if (row.values.district.trim()) patch.district = input.district
      if (row.values.barcode.trim()) patch.barcode = input.barcode
      if (row.values.preferred_channel.trim()) patch.preferred_channel = input.preferred_channel
      if (row.values.notes.trim()) patch.notes = input.notes
      if (row.values.status.trim()) patch.status = input.status
      await updateCustomer(row.existingId, patch)
    }
  },
}
