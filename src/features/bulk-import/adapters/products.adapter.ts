import {
  createBrand,
  createCategory,
  createProductAtomic,
  getProduct,
  listBrands,
  listCategories,
  updateProduct,
  type ProductInput,
} from '@/features/products/repositories/catalog.repository'
import { blankSafeMerge, describeDiff, markWithinFileDuplicates } from '../lib/diff'
import { cellAt, mapHeaders, parseNonNegativeNumber } from '../lib/normalize'
import { lookupProductsForImport } from '../repositories/import.repository'
import type { BulkImportAdapter, ImportCommitContext, ImportPreviewRow } from '../types'

const HEADERS = [
  'name',
  'category',
  'brand',
  'sku',
  'barcode',
  'purchase_price',
  'selling_price',
  'opening_stock',
  'status',
] as const

const ALIASES: Record<string, string[]> = {
  name: ['product_name', 'product', 'title'],
  category: ['category_name', 'cat'],
  brand: ['brand_name'],
  sku: ['base_sku', 'sku_code', 'product_sku'],
  barcode: ['base_barcode', 'ean', 'upc'],
  purchase_price: ['cost', 'buy_price', 'purchase'],
  selling_price: ['price', 'mrp', 'sell_price', 'sale_price'],
  opening_stock: ['stock', 'qty', 'quantity', 'opening_qty'],
  status: ['product_status', 'lifecycle'],
}

function validateProductRow(row: ImportPreviewRow): ImportPreviewRow {
  const errors: string[] = []
  const name = row.values.name?.trim() ?? ''
  if (!name) errors.push('Name is required')
  if (name.length > 200) errors.push('Name too long')
  const purchase = parseNonNegativeNumber(row.values.purchase_price ?? '')
  const selling = parseNonNegativeNumber(row.values.selling_price ?? '')
  const stock = parseNonNegativeNumber(row.values.opening_stock ?? '0')
  if (row.values.purchase_price && purchase == null) errors.push('Invalid purchase price')
  if (row.values.selling_price && selling == null) errors.push('Invalid selling price')
  if (row.values.opening_stock && stock == null) errors.push('Invalid opening stock')
  const status = (row.values.status || 'draft').toLowerCase()
  if (!['draft', 'active', 'archived'].includes(status) && row.values.status) {
    errors.push('Status must be draft, active, or archived')
  }
  if (!row.matchKey && !name) {
    /* already covered */
  }
  if (errors.length) {
    return { ...row, action: 'error', errors, diff: [] }
  }
  if (row.action === 'error') {
    return { ...row, action: row.existingId ? 'update' : 'create', errors: [] }
  }
  return { ...row, errors: [] }
}

export const productsAdapter: BulkImportAdapter = {
  entityType: 'products',
  title: 'Import products',
  description: 'Upload a CSV, review matches, then create or update products.',
  listPath: '/products',
  permission: 'products.import',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand' },
    { key: 'purchase_price', label: 'Purchase' },
    { key: 'selling_price', label: 'Selling' },
    { key: 'opening_stock', label: 'Stock' },
    { key: 'status', label: 'Status' },
  ],
  templateHeaders: [...HEADERS],
  templateSample: [
    'Sample Product',
    'Skincare',
    'Brand A',
    'SKU-001',
    '8901234567890',
    '100',
    '150',
    '10',
    'draft',
  ],
  columnGuide: [
    'Match key: sku, then barcode.',
    'Blank cells on update leave existing values unchanged.',
    'Missing category/brand names are created automatically on commit.',
    'Opening stock applies on create only (active branch).',
  ],
  headerAliases: ALIASES,
  parseRows(matrix) {
    if (matrix.length < 2) return []
    const idx = mapHeaders(matrix[0], [...HEADERS], ALIASES)
    const rows: ImportPreviewRow[] = matrix.slice(1).map((cells, i) => {
      const values: Record<string, string> = {}
      for (const key of HEADERS) values[key] = cellAt(cells, idx[key])
      const sku = values.sku
      const barcode = values.barcode
      const matchKey = sku || barcode
      const base: ImportPreviewRow = {
        rowNum: i + 2,
        action: 'create',
        matchKey,
        existingId: null,
        values,
        diff: [],
        errors: [],
        notes: [],
      }
      return validateProductRow(base)
    })
    return markWithinFileDuplicates(rows)
  },
  async enrichMatches(rows) {
    const skus = rows.map((r) => r.values.sku).filter(Boolean)
    const barcodes = rows.map((r) => r.values.barcode).filter(Boolean)
    let matches: Awaited<ReturnType<typeof lookupProductsForImport>> = []
    try {
      matches = await lookupProductsForImport(skus, barcodes)
    } catch {
      // Fallback: continue as create-only if RPC unavailable
      matches = []
    }
    const bySku = new Map<string, (typeof matches)[0]>()
    const byBarcode = new Map<string, (typeof matches)[0]>()
    for (const m of matches) {
      const sku = String(m.snapshot.sku ?? '')
      const barcode = String(m.snapshot.barcode ?? '')
      if (sku) bySku.set(sku.toLowerCase(), m)
      if (barcode) byBarcode.set(barcode, m)
    }

    const cats = await listCategories({ pageSize: 500 })
    const brands = await listBrands({ pageSize: 500 })
    const catByName = new Map(cats.items.map((c) => [c.name.trim().toLowerCase(), c]))
    const brandByName = new Map(brands.items.map((b) => [b.name.trim().toLowerCase(), b]))

    return rows.map((row) => {
      if (row.action === 'error') return row
      const sku = row.values.sku.trim()
      const barcode = row.values.barcode.trim()
      const hit = (sku && bySku.get(sku.toLowerCase())) || (barcode && byBarcode.get(barcode)) || null
      const notes: string[] = []
      const catName = row.values.category.trim().toLowerCase()
      const brandName = row.values.brand.trim().toLowerCase()
      if (catName && !catByName.has(catName)) notes.push(`Will create category “${row.values.category}”`)
      if (brandName && !brandByName.has(brandName)) notes.push(`Will create brand “${row.values.brand}”`)

      if (!hit) {
        return validateProductRow({ ...row, action: 'create', existingId: null, diff: [], notes })
      }

      const snap = hit.snapshot
      const incoming: Record<string, unknown> = {
        name: row.values.name || undefined,
        base_sku: row.values.sku || undefined,
        base_barcode: row.values.barcode || undefined,
        purchase_price: parseNonNegativeNumber(row.values.purchase_price) ?? undefined,
        selling_price: parseNonNegativeNumber(row.values.selling_price) ?? undefined,
        status: row.values.status || undefined,
      }
      const existing = {
        name: snap.name,
        base_sku: snap.sku,
        base_barcode: snap.barcode,
        purchase_price: snap.purchase_price,
        selling_price: snap.selling_price,
        status: snap.status,
      }
      const patch = blankSafeMerge(existing as Record<string, unknown>, incoming)
      const diff = describeDiff(patch)
      if (diff.length === 0 && !notes.length) {
        return validateProductRow({
          ...row,
          action: 'skip',
          existingId: hit.id,
          matchKey: hit.matchKey || row.matchKey,
          diff: [],
          notes: ['No changes'],
        })
      }
      return validateProductRow({
        ...row,
        action: 'update',
        existingId: hit.id,
        matchKey: hit.matchKey || row.matchKey,
        diff,
        notes,
      })
    })
  },
  revalidateRow(row) {
    const matchKey = row.values.sku.trim() || row.values.barcode.trim()
    return validateProductRow({ ...row, matchKey })
  },
  async commitRow(row, ctx: ImportCommitContext) {
    if (row.action === 'skip' || row.action === 'error') return
    if (!ctx.organizationId) throw new Error('Missing organization')

    let categoryId: string | null = null
    let brandId: string | null = null
    const catName = row.values.category.trim()
    const brandName = row.values.brand.trim()

    if (catName) {
      const cats = await listCategories({ pageSize: 500, search: catName })
      const found = cats.items.find((c) => c.name.trim().toLowerCase() === catName.toLowerCase())
      if (found) categoryId = found.id
      else {
        const created = await createCategory(ctx.organizationId, {
          name: catName,
          code: null,
          description: null,
          sort_order: 0,
          is_active: true,
        })
        categoryId = created.id
      }
    }

    if (brandName) {
      const brands = await listBrands({ pageSize: 500, search: brandName })
      const found = brands.items.find((b) => b.name.trim().toLowerCase() === brandName.toLowerCase())
      if (found) brandId = found.id
      else {
        const created = await createBrand(ctx.organizationId, {
          name: brandName,
          code: null,
          description: null,
          is_active: true,
        })
        brandId = created.id
      }
    }

    const purchase = parseNonNegativeNumber(row.values.purchase_price) ?? 0
    const selling = parseNonNegativeNumber(row.values.selling_price) ?? 0
    const stock = parseNonNegativeNumber(row.values.opening_stock) ?? 0
    const status = (row.values.status || 'draft').toLowerCase()

    if (row.action === 'create') {
      const payload: Record<string, unknown> = {
        name: row.values.name.trim(),
        base_sku: row.values.sku || null,
        base_barcode: row.values.barcode || null,
        purchase_price: purchase,
        selling_price: selling,
        category_id: categoryId,
        brand_id: brandId,
        status: status === 'active' && categoryId ? 'active' : 'draft',
        has_variants: false,
      }
      if (stock > 0 && ctx.activeBranchId) {
        payload.opening_stock = [
          {
            branch_id: ctx.activeBranchId,
            quantity: stock,
            unit_cost: purchase,
          },
        ]
      }
      await createProductAtomic(payload)
      return
    }

    if (row.action === 'update' && row.existingId) {
      const current = await getProduct(row.existingId)
      if (!current) throw new Error('Product no longer exists')
      const incoming: Partial<ProductInput> = {}
      if (row.values.name.trim()) incoming.name = row.values.name.trim()
      if (row.values.sku.trim()) incoming.base_sku = row.values.sku.trim()
      if (row.values.barcode.trim()) incoming.base_barcode = row.values.barcode.trim()
      if (row.values.purchase_price.trim()) incoming.purchase_price = purchase
      if (row.values.selling_price.trim()) incoming.selling_price = selling
      if (categoryId) incoming.category_id = categoryId
      if (brandId) incoming.brand_id = brandId
      if (row.values.status.trim()) {
        incoming.is_active = status === 'active'
      }
      const patch = blankSafeMerge(
        {
          name: current.name,
          base_sku: current.base_sku,
          base_barcode: current.base_barcode,
          purchase_price: current.purchase_price,
          selling_price: current.selling_price,
          category_id: current.category_id,
          brand_id: current.brand_id,
          is_active: current.is_active,
        } as Record<string, unknown>,
        incoming as Record<string, unknown>,
      )
      await updateProduct(row.existingId, {
        name: String(patch.name ?? current.name),
        description: current.description,
        category_id: (patch.category_id as string | null | undefined) ?? current.category_id,
        subcategory_id: current.subcategory_id,
        brand_id: (patch.brand_id as string | null | undefined) ?? current.brand_id,
        product_type: current.product_type,
        unit: current.unit ?? 'pcs',
        base_sku: (patch.base_sku as string | null | undefined) ?? current.base_sku,
        base_barcode: (patch.base_barcode as string | null | undefined) ?? current.base_barcode,
        purchase_price: Number(patch.purchase_price ?? current.purchase_price ?? 0),
        selling_price: Number(patch.selling_price ?? current.selling_price ?? 0),
        wholesale_price: current.wholesale_price,
        reorder_level: current.reorder_level ?? 0,
        tax_rate: current.tax_rate ?? 0,
        is_active: Boolean(patch.is_active ?? current.is_active),
        track_inventory: current.track_inventory ?? true,
        has_variants: current.has_variants ?? false,
      })
    }
  },
}
