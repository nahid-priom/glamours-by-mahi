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
  'size',
  'color',
  'variant_sku',
  'variant_barcode',
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
  size: ['volume', 'variant_size', 'option1'],
  color: ['shade', 'variant_color', 'option2'],
  variant_sku: ['sku_variant', 'child_sku'],
  variant_barcode: ['barcode_variant', 'child_barcode', 'ean_variant'],
}

function validateProductRow(row: ImportPreviewRow): ImportPreviewRow {
  const errors: string[] = []
  const name = row.values.name?.trim() ?? ''
  if (!name) errors.push('Name is required')
  if (name.length > 200) errors.push('Name too long')

  const category = row.values.category?.trim() ?? ''
  const status = (row.values.status || 'draft').toLowerCase()
  if (status === 'active' && !category) {
    errors.push('Category is required to activate')
  }

  const purchase = parseNonNegativeNumber(row.values.purchase_price ?? '')
  const selling = parseNonNegativeNumber(row.values.selling_price ?? '')
  const stock = parseNonNegativeNumber(row.values.opening_stock ?? '0')
  if (row.values.purchase_price && purchase == null) errors.push('Invalid purchase price')
  if (row.values.selling_price && selling == null) errors.push('Invalid selling price')
  if (row.values.opening_stock && stock == null) errors.push('Invalid opening stock')
  if (!['draft', 'active', 'archived'].includes(status) && row.values.status) {
    errors.push('Status must be draft, active, or archived')
  }

  const size = row.values.size?.trim() ?? ''
  const color = row.values.color?.trim() ?? ''
  if ((size && !color) || (!size && color)) {
    errors.push('Size/volume and color/shade are both required for variant rows')
  }

  if (errors.length) {
    return { ...row, action: 'error', errors, diff: [] }
  }
  if (row.action === 'error') {
    return { ...row, action: row.existingId ? 'update' : 'create', errors: [] }
  }
  return { ...row, errors: [] }
}

function groupKey(row: ImportPreviewRow): string {
  const sku = row.values.sku?.trim().toLowerCase()
  if (sku) return `sku:${sku}`
  return `name:${row.values.name.trim().toLowerCase()}`
}

export const productsAdapter: BulkImportAdapter = {
  entityType: 'products',
  title: 'Import products',
  description: 'Upload a CSV for simple or variant products, review matches, then commit.',
  listPath: '/products',
  permission: 'products.import',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'size', label: 'Size' },
    { key: 'color', label: 'Color' },
    { key: 'variant_sku', label: 'Variant SKU' },
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand' },
    { key: 'purchase_price', label: 'Purchase' },
    { key: 'selling_price', label: 'Selling' },
    { key: 'opening_stock', label: 'Stock' },
    { key: 'status', label: 'Status' },
  ],
  templateHeaders: [...HEADERS],
  templateSample: [
    'Matte Lipstick',
    'Makeup',
    'Maybelline',
    'MAT-LIP',
    '',
    '550',
    '850',
    '12',
    'active',
    '3.5g',
    'Ruby Red',
    'MAT-LIP-RR-35',
    '8901234567890',
  ],
  columnGuide: [
    'Match key: sku, then barcode.',
    'Variant rows: set size + color (and optional variant_sku / variant_barcode).',
    'Rows that share the same name/base SKU are grouped into one variant product on create.',
    'Blank cells on update leave existing values unchanged.',
    'Missing category/brand names are created automatically on commit.',
    'Opening stock applies on create only (active branch).',
    'Category is required to activate.',
  ],
  headerAliases: ALIASES,
  parseRows(matrix) {
    if (matrix.length < 2) return []
    const idx = mapHeaders(matrix[0], [...HEADERS], ALIASES)
    const rows: ImportPreviewRow[] = matrix.slice(1).map((cells, i) => {
      const values: Record<string, string> = {}
      for (const key of HEADERS) values[key] = cellAt(cells, idx[key])
      const sku = values.sku
      const barcode = values.barcode || values.variant_barcode
      const size = values.size?.trim()
      const color = values.color?.trim()
      // Variant rows share base SKU; uniqueness is per combination / variant identity.
      const matchKey =
        size && color
          ? `${sku || values.name}::${color}::${size}`
          : values.variant_sku?.trim() || sku || barcode
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
    const barcodes = rows
      .map((r) => r.values.barcode || r.values.variant_barcode)
      .filter(Boolean)
    let matches: Awaited<ReturnType<typeof lookupProductsForImport>> = []
    try {
      matches = await lookupProductsForImport(skus, barcodes)
    } catch {
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
      const barcode = row.values.barcode.trim() || row.values.variant_barcode.trim()
      const hit = (sku && bySku.get(sku.toLowerCase())) || (barcode && byBarcode.get(barcode)) || null
      const notes: string[] = []
      const catName = row.values.category.trim().toLowerCase()
      const brandName = row.values.brand.trim().toLowerCase()
      if (catName && !catByName.has(catName)) notes.push(`Will create category “${row.values.category}”`)
      if (brandName && !brandByName.has(brandName)) notes.push(`Will create brand “${row.values.brand}”`)
      if (row.values.size.trim() && row.values.color.trim()) {
        notes.push('Variant row (size/color)')
      }

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
    const size = row.values.size?.trim()
    const color = row.values.color?.trim()
    const matchKey =
      size && color
        ? `${row.values.sku.trim() || row.values.name.trim()}::${color}::${size}`
        : row.values.variant_sku.trim() ||
          row.values.sku.trim() ||
          row.values.barcode.trim() ||
          row.values.variant_barcode.trim()
    return validateProductRow({ ...row, matchKey })
  },
  async commitRow(row, ctx: ImportCommitContext) {
    if (row.action === 'skip' || row.action === 'error') return
    if (!ctx.organizationId) throw new Error('Missing organization')

    if (row.action === 'create') {
      const key = groupKey(row)
      const siblings = (ctx.allRows ?? [row]).filter(
        (r) => r.action === 'create' && groupKey(r) === key,
      )
      const leader = siblings.reduce((a, b) => (a.rowNum <= b.rowNum ? a : b), row)
      ctx.committedGroupKeys ??= new Set()
      if (ctx.committedGroupKeys.has(key)) return
      if (leader.rowNum !== row.rowNum) return
      ctx.committedGroupKeys.add(key)

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
      const status = (row.values.status || 'draft').toLowerCase()
      const variantRows = siblings.filter((r) => r.values.size?.trim() && r.values.color?.trim())
      const hasVariants = variantRows.length > 0

      const payload: Record<string, unknown> = {
        name: row.values.name.trim(),
        base_sku: row.values.sku || null,
        base_barcode: row.values.barcode || null,
        purchase_price: purchase,
        selling_price: selling,
        category_id: categoryId,
        brand_id: brandId,
        status: status === 'active' && categoryId ? 'active' : 'draft',
        has_variants: hasVariants,
        product_type: hasVariants ? 'variable' : 'simple',
        client_txn_key: crypto.randomUUID(),
      }

      if (hasVariants) {
        const sizes = Array.from(new Set(variantRows.map((r) => r.values.size.trim())))
        const colors = Array.from(new Set(variantRows.map((r) => r.values.color.trim())))
        const comboKeys = new Set<string>()
        for (const r of variantRows) {
          const key = `${r.values.color.trim()}::${r.values.size.trim()}`
          if (comboKeys.has(key)) {
            throw new Error(`Duplicate variant combination ${key} in import group`)
          }
          comboKeys.add(key)
        }
        payload.options = [
          { name: 'Size', values: sizes.map((v) => ({ value: v })) },
          { name: 'Color', values: colors.map((v) => ({ value: v })) },
        ]
        payload.variants = variantRows.map((r) => {
          const size = r.values.size.trim()
          const color = r.values.color.trim()
          const vPurchase = parseNonNegativeNumber(r.values.purchase_price) ?? purchase
          const vSelling = parseNonNegativeNumber(r.values.selling_price) ?? selling
          return {
            key: `${color}::${size}`,
            size,
            color,
            sku: r.values.variant_sku.trim() || r.values.sku.trim() || undefined,
            barcode: r.values.variant_barcode.trim() || r.values.barcode.trim() || null,
            name: `${color} / ${size}`,
            purchase_price: vPurchase,
            selling_price: vSelling,
            is_active: true,
          }
        })

        if (ctx.activeBranchId) {
          const stockEntries = variantRows
            .map((r) => {
              const qty = parseNonNegativeNumber(r.values.opening_stock) ?? 0
              if (qty <= 0) return null
              return {
                branch_id: ctx.activeBranchId,
                variant_key: `${r.values.color.trim()}::${r.values.size.trim()}`,
                quantity: qty,
                unit_cost: parseNonNegativeNumber(r.values.purchase_price) ?? purchase,
              }
            })
            .filter(Boolean)
          if (stockEntries.length > 0) payload.opening_stock = stockEntries
        }
      } else {
        const stock = parseNonNegativeNumber(row.values.opening_stock) ?? 0
        if (stock > 0 && ctx.activeBranchId) {
          payload.opening_stock = [
            {
              branch_id: ctx.activeBranchId,
              quantity: stock,
              unit_cost: purchase,
            },
          ]
        }
      }

      await createProductAtomic(payload)
      return
    }

    if (row.action === 'update' && row.existingId) {
      let categoryId: string | null = null
      let brandId: string | null = null
      const catName = row.values.category.trim()
      const brandName = row.values.brand.trim()
      const purchase = parseNonNegativeNumber(row.values.purchase_price) ?? 0
      const selling = parseNonNegativeNumber(row.values.selling_price) ?? 0
      const status = (row.values.status || 'draft').toLowerCase()

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
