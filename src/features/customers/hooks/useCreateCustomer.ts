import { useCallback, useState } from 'react'
import {
  customersService,
  DuplicateCustomerError,
  type CreateCustomerInput,
} from '@/services/customers.service'
import type { Customer } from '@/database/schema'
import { TransactionError } from '@/database/transaction'

export function useCreateCustomer() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Customer | null>(null)

  const create = async (input: CreateCustomerInput): Promise<Customer | null> => {
    setSaving(true)
    setError(null)
    setDuplicate(null)
    try {
      return customersService.createCustomer(input)
    } catch (e) {
      if (e instanceof DuplicateCustomerError) {
        setDuplicate(e.existing)
        setError(e.message)
        return null
      }
      setError(e instanceof TransactionError || e instanceof Error ? e.message : 'Could not create customer')
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
