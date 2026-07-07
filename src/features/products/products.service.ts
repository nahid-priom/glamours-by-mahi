import type { Product } from '@/types'
import type { ProductFilters, ProductFormInput, ProductStats } from './products.types'
import { LOW_STOCK_THRESHOLD } from '@/lib/constants'
import { generateId } from '@/lib/id'
import { MOCK_PRODUCTS, MOCK_STORES } from '@/lib/mock-data'
import { getStorageItem, setStorageItem, STORAGE_KEYS, updateStorageItem } from '@/lib/storage'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

function deriveStatus(stock: number, status: Product['status']): Product['status'] {
  if (status === 'inactive') return 'inactive'
  if (stock <= 0) return 'out_of_stock'
  return 'active'
}

function normalizeProduct(p: Product): Product {
  return {
    ...p,
    status: deriveStatus(p.stock, p.status),
  }
}

function loadProducts(): Product[] {
  const stored = getStorageItem<Product[]>(STORAGE_KEYS.products, [])
  if (stored.length === 0) {
    const seeded = MOCK_PRODUCTS.map(normalizeProduct)
    setStorageItem(STORAGE_KEYS.products, seeded)
    return seeded
  }
  return stored.map(normalizeProduct)
}

function applyFilters(products: Product[], filters?: ProductFilters): Product[] {
  let result = [...products]
  if (!filters?.include_deleted) {
    result = result.filter((p) => !p.deleted_at)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }
  if (filters?.store && filters.store !== 'all') {
    result = result.filter((p) => p.store_id === filters.store)
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((p) => p.status === filters.status)
  }
  return result
}

export const productsService = {
  async getProducts(filters?: ProductFilters) {
    await delay()
    return applyFilters(loadProducts(), filters)
  },

  async getProductById(id: string) {
    await delay(150)
    return loadProducts().find((p) => p.id === id) ?? null
  },

  async getProductBySku(sku: string, excludeId?: string) {
    await delay(100)
    return (
      loadProducts().find(
        (p) => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== excludeId && !p.deleted_at,
      ) ?? null
    )
  },

  async getStats(): Promise<ProductStats> {
    await delay(150)
    const products = loadProducts().filter((p) => !p.deleted_at)
    return {
      total: products.length,
      active: products.filter((p) => p.status === 'active').length,
      low_stock: products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
      out_of_stock: products.filter((p) => p.status === 'out_of_stock').length,
    }
  },

  async createProduct(input: ProductFormInput) {
    await delay(250)
    const existing = await this.getProductBySku(input.sku)
    if (existing) throw new Error('SKU already exists')

    const store = MOCK_STORES.find((s) => s.id === input.store_id)
    const now = new Date().toISOString()
    const product: Product = normalizeProduct({
      id: generateId('p'),
      name: input.name,
      sku: input.sku,
      price: input.price,
      stock: input.stock,
      store_id: input.store_id,
      store_name: store?.name ?? 'Unknown Store',
      status: input.status,
      created_at: now,
      updated_at: now,
    })

    updateStorageItem(STORAGE_KEYS.products, loadProducts(), (current) => [product, ...current])
    return product
  },

  async updateProduct(id: string, input: Partial<ProductFormInput>) {
    await delay(250)
    if (input.sku) {
      const existing = await this.getProductBySku(input.sku, id)
      if (existing) throw new Error('SKU already exists')
    }

    let updated: Product | null = null
    updateStorageItem(STORAGE_KEYS.products, loadProducts(), (current) =>
      current.map((p) => {
        if (p.id !== id) return p
        const store = input.store_id
          ? MOCK_STORES.find((s) => s.id === input.store_id)
          : undefined
        updated = normalizeProduct({
          ...p,
          ...input,
          store_name: store?.name ?? p.store_name,
          updated_at: new Date().toISOString(),
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Product not found')
    return updated
  },

  async adjustStock(id: string, delta: number) {
    await delay(200)
    let updated: Product | null = null
    updateStorageItem(STORAGE_KEYS.products, loadProducts(), (current) =>
      current.map((p) => {
        if (p.id !== id) return p
        const stock = Math.max(0, p.stock + delta)
        updated = normalizeProduct({
          ...p,
          stock,
          updated_at: new Date().toISOString(),
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Product not found')
    return updated
  },

  async softDelete(id: string) {
    await delay(200)
    const now = new Date().toISOString()
    updateStorageItem(STORAGE_KEYS.products, loadProducts(), (current) =>
      current.map((p) =>
        p.id === id ? { ...p, deleted_at: now, updated_at: now, status: 'inactive' as const } : p,
      ),
    )
  },

  async restore(id: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.products, loadProducts(), (current) =>
      current.map((p) => {
        if (p.id !== id) return p
        return normalizeProduct({
          ...p,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
      }),
    )
  },
}
