export type SupplierProfileTab = 'ledger' | 'stock' | 'details'

export type SupplierDirectoryViewMode = 'cards' | 'table'

export type SupplierExtendedFields = {
  code?: string | null
  business_type?: string | null
  contact_person?: string | null
  vat_reg_no?: string | null
  payment_terms_days?: number | null
  credit_limit?: number | null
  established_year?: number | null
}

export type SupplierDocument = {
  id: string
  supplier_id: string
  file_name: string
  file_path: string
  mime_type: string | null
  file_size: number | null
  created_at: string
}