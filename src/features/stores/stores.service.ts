import { supabase } from '@/lib/supabase/client'
import type { Store, StoreFilters, StoreFormInput, StoreStats } from './stores.types'

type BranchRow = {
  id: string
  name: string
  code: string
  phone: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  organization_id: string
}

function branchToStore(b: BranchRow): Store {
  return {
    id: b.id,
    name: b.name,
    type: 'manual',
    logo_url: null,
    phone: b.phone,
    email: null,
    address: b.address,
    invoice_prefix: b.code,
    default_courier_id: null,
    status: b.deleted_at ? 'archived' : b.is_active ? 'active' : 'inactive',
    api_status: 'connected',
    created_at: b.created_at,
    updated_at: b.updated_at,
    deleted_at: b.deleted_at,
    created_by: b.created_by ?? 'system',
    updated_by: b.updated_by ?? 'system',
  }
}

async function requireOrgId() {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data?.organization_id) throw new Error('Organization not found')
  return data.organization_id
}

function applyFilters(stores: Store[], filters?: StoreFilters): Store[] {
  let result = [...stores]
  if (!filters?.include_deleted) {
    result = result.filter((s) => !s.deleted_at)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.invoice_prefix.toLowerCase().includes(q) ||
        (s.phone?.includes(q) ?? false),
    )
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((s) => s.status === filters.status)
  }
  if (filters?.type && filters.type !== 'all') {
    result = result.filter((s) => s.type === filters.type)
  }
  return result
}

export const storesService = {
  async getStores(filters?: StoreFilters): Promise<Store[]> {
    let q = supabase
      .from('branches')
      .select(
        'id, name, code, phone, address, is_active, created_at, updated_at, deleted_at, created_by, updated_by, organization_id',
      )
      .order('name')

    if (!filters?.include_deleted) {
      q = q.is('deleted_at', null)
    }

    const { data, error } = await q
    if (error) throw error
    return applyFilters((data ?? []).map((b) => branchToStore(b as BranchRow)), filters)
  },

  async getStats(): Promise<StoreStats> {
    const stores = await this.getStores({ include_deleted: false })
    return {
      total: stores.length,
      active: stores.filter((s) => s.status === 'active').length,
      connected: stores.filter((s) => s.api_status === 'connected').length,
      inactive: stores.filter((s) => s.status === 'inactive').length,
    }
  },

  async getById(id: string): Promise<Store | null> {
    const { data, error } = await supabase
      .from('branches')
      .select(
        'id, name, code, phone, address, is_active, created_at, updated_at, deleted_at, created_by, updated_by, organization_id',
      )
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? branchToStore(data as BranchRow) : null
  },

  async create(input: StoreFormInput): Promise<Store> {
    const orgId = await requireOrgId()
    const code = (input.invoice_prefix || input.name).trim().toUpperCase().slice(0, 12)
    const { data, error } = await supabase
      .from('branches')
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        code,
        phone: input.phone || null,
        address: input.address || null,
        is_active: input.status === 'active',
      })
      .select(
        'id, name, code, phone, address, is_active, created_at, updated_at, deleted_at, created_by, updated_by, organization_id',
      )
      .single()
    if (error) throw error
    return branchToStore(data as BranchRow)
  },

  async update(id: string, input: StoreFormInput): Promise<Store> {
    const { data, error } = await supabase
      .from('branches')
      .update({
        name: input.name.trim(),
        code: input.invoice_prefix.trim().toUpperCase().slice(0, 12),
        phone: input.phone || null,
        address: input.address || null,
        is_active: input.status === 'active',
        deleted_at: input.status === 'archived' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select(
        'id, name, code, phone, address, is_active, created_at, updated_at, deleted_at, created_by, updated_by, organization_id',
      )
      .single()
    if (error) throw error
    return branchToStore(data as BranchRow)
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('branches')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
    if (error) throw error
  },

  async restore(id: string): Promise<void> {
    const { error } = await supabase
      .from('branches')
      .update({ deleted_at: null, is_active: true })
      .eq('id', id)
    if (error) throw error
  },
}
