import { useEffect, useState } from 'react'
import { customersService } from '@/services/customers.service'
import type { Customer } from '@/database/schema'

export function useCustomerSearch(query: string, limit = 10) {
  const [results, setResults] = useState<Customer[]>([])
  const [debounced, setDebounced] = useState(query)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 200)
    return () => window.clearTimeout(id)
  }, [query])

  useEffect(() => {
    setLoading(true)
    try {
      setResults(customersService.searchCustomers(debounced, limit))
    } finally {
      setLoading(false)
    }
  }, [debounced, limit])

  return { results, loading, query: debounced }
}
