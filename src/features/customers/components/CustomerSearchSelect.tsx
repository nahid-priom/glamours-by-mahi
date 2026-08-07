import { useEffect, useId, useRef, useState } from 'react'
import { Plus, Search, UserPlus } from 'lucide-react'
import { useCustomerSearch } from '../hooks/useCustomerSearch'
import { CustomerSearchResult } from './CustomerSearchResult'
import { SelectedCustomerCard } from './SelectedCustomerCard'
import { AddCustomerDialog } from './AddCustomerDialog'
import { customersService } from '@/services/customers.service'
import { looksLikePhoneQuery } from '@/lib/phone-utils'
import type { Customer } from '../customers.types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CustomerSearchSelectProps {
  value: string | null
  onChange: (customerId: string | null) => void
  preferredBranchId?: string | null
  className?: string
}

export function CustomerSearchSelect({
  value,
  onChange,
  preferredBranchId,
  className,
}: CustomerSearchSelectProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [editing, setEditing] = useState(!value)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogPhone, setDialogPhone] = useState('')
  const [dialogName, setDialogName] = useState('')
  const [tick, setTick] = useState(0)

  const { results, loading } = useCustomerSearch(query, 10)
  const selected = value
    ? (customersService.getById(value) as unknown as Customer | null)
    : null

  // Refresh selected after create (tick forces re-read)
  useEffect(() => {
    void tick
  }, [tick])

  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  const openAddDialog = (fromQuery = false) => {
    if (fromQuery && looksLikePhoneQuery(query)) {
      setDialogPhone(query.trim())
      setDialogName('')
    } else if (fromQuery) {
      setDialogPhone('')
      setDialogName(query.trim())
    } else {
      setDialogPhone('')
      setDialogName('')
    }
    setDialogOpen(true)
    setOpen(false)
  }

  const selectCustomer = (customer: Customer) => {
    onChange(customer.id)
    setEditing(false)
    setOpen(false)
    setQuery('')
    setTick((t) => t + 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && open && results[activeIndex]) {
      e.preventDefault()
      selectCustomer(results[activeIndex])
    }
  }

  if (selected && !editing) {
    return (
      <div className={className}>
        <SelectedCustomerCard
          customer={selected}
          onChange={() => {
            setEditing(true)
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          onClear={() => {
            onChange(null)
            setEditing(true)
            setQuery('')
          }}
        />
        <AddCustomerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialPhone={dialogPhone}
          initialName={dialogName}
          preferredBranchId={preferredBranchId}
          onCreated={selectCustomer}
          onSelectExisting={selectCustomer}
        />
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <label className="mb-1.5 block text-xs font-semibold text-[#6B7280]">Customer</label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay so option click registers
              window.setTimeout(() => setOpen(false), 150)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search customer by name or phone…"
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm outline-none ring-0 focus:border-[#111111]"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
          onClick={() => openAddDialog(false)}
          aria-label="Add Customer"
          title="Add Customer"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1.5 max-h-72 w-full overflow-auto rounded-2xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
        >
          {loading && (
            <p className="px-3 py-3 text-xs text-[#6B7280]">Searching…</p>
          )}
          {!loading && results.length > 0 && (
            results.map((c, i) => (
              <CustomerSearchResult
                key={c.id}
                customer={c}
                query={query}
                active={i === activeIndex}
                onSelect={selectCustomer}
              />
            ))
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-sm font-medium text-[#111111]">No customer found</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                {query.trim()
                  ? `No match for “${query.trim()}”`
                  : 'Start typing a name or mobile number'}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3 rounded-full"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openAddDialog(true)}
              >
                <UserPlus className="h-4 w-4" />
                Add New Customer
              </Button>
            </div>
          )}
        </div>
      )}

      <AddCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialPhone={dialogPhone}
        initialName={dialogName}
        preferredBranchId={preferredBranchId}
        onCreated={selectCustomer}
        onSelectExisting={selectCustomer}
      />
    </div>
  )
}
