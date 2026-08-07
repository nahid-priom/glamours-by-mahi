import { useCallback, useState } from 'react'
import {
  customersService,
  DuplicateCustomerError,
  type CreateCustomerInput,
} from '@/services/customers.service'
import type { Customer } from '../customers.types'

function asUiCustomer(raw: unknown): Customer {
  const c = raw as Record<string, unknown>
  return {
    id: String(c.id ?? ''),
    name: String(c.name ?? ''),
    phone: String(c.phone ?? ''),
    email: String(c.email ?? ''),
    address: String(c.address ?? ''),
    district: String(c.district ?? ''),
    total_orders: Number(c.total_orders ?? 0),
    delivered_orders: Number(c.delivered_orders ?? 0),
    returned_orders: Number(c.returned_orders ?? 0),
    cancelled_orders: Number(c.cancelled_orders ?? 0),
    total_spent: Number(c.total_spent ?? 0),
    return_rate: Number(c.return_rate ?? 0),
    fraud_level: (c.fraud_level as Customer['fraud_level']) ?? 'SAFE',
    is_blacklisted: Boolean(c.is_blacklisted),
    blacklist_reason: (c.blacklist_reason as string | null) ?? null,
    customer_note: String(c.customer_note ?? ''),
    status: (c.status as Customer['status']) ?? 'active',
    created_at: String(c.created_at ?? new Date().toISOString()),
    updated_at: String(c.updated_at ?? new Date().toISOString()),
    currentDue: Number(c.currentDue ?? c.current_due ?? 0),
  }
}

/** Legacy helper for unmounted SalesPos customer dialog — prefer PosQuickAddCustomerDialog. */
export function useCreateCustomer() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Customer | null>(null)

  const create = async (input: CreateCustomerInput): Promise<Customer | null> => {
    setSaving(true)
    setError(null)
    setDuplicate(null)
    try {
      return asUiCustomer(await customersService.createCustomer(input))
    } catch (e) {
      if (e instanceof DuplicateCustomerError) {
        setDuplicate(asUiCustomer(e.existing))
        setError(e.message)
        return null
      }
      setError(e instanceof Error ? e.message : 'Could not create customer')
      return null
    } finally {
      setSaving(false)
    }
  }

  const reset = useCallback(() => {
    setError(null)
    setDuplicate(null)
  }, [])

  return { create, saving, error, duplicate, reset }
}
