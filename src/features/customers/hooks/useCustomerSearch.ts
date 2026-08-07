import { useEffect, useState } from 'react'
import { searchCustomers } from '../repositories/customers.repository'
import type { Customer } from '../customers.types'

/** Maps repository entity options into Customer-shaped rows for legacy select UIs. */
export function useCustomerSearch(query: string, limit = 10) {
  const [results, setResults] = useState<Customer[]>([])
  const [debounced, setDebounced] = useState(query)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 200)
    return () => window.clearTimeout(id)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void searchCustomers(debounced)
      .then((rows) => {
        if (cancelled) return
        setResults(
          rows.slice(0, limit).map((row) => ({
            id: row.id,
            name: row.label,
            phone: row.description ?? '',
            email: '',
            address: '',
            district: '',
            total_orders: 0,
            delivered_orders: 0,
            returned_orders: 0,
            cancelled_orders: 0,
            total_spent: 0,
            return_rate: 0,
            fraud_level: 'SAFE',
            is_blacklisted: false,
            blacklist_reason: null,
            customer_note: '',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, limit])

  return { results, loading, query: debounced }
}
