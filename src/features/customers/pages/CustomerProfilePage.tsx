import { useEffect, useId, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/features/auth/auth-session'
import { getPosCustomerSummary } from '@/features/customer-rating'
import { queryKeys } from '@/lib/query/keys'
import { CustomerProfileHeader } from '../components/CustomerProfileHeader'
import { CustomerProfileTabs } from '../components/CustomerProfileTabs'
import { CustomerDetailsTab } from '../details/CustomerDetailsTab'
import { CustomerOrdersTab } from '../details/CustomerOrdersTab'
import { CustomerLedgerTab } from '../ledger/CustomerLedgerTab'
import type { CustomerProfileTab } from '../types/customer-profile.types'
import { getCustomer, softDeleteCustomer } from '../repositories/customers.repository'

function parseTab(value: string | null): CustomerProfileTab {
  if (value === 'orders' || value === 'details' || value === 'ledger') return value
  return 'ledger'
}

export function CustomerProfilePage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const panelBaseId = useId()
  const qc = useQueryClient()
  const { profile } = useAuth()

  const tab = parseTab(searchParams.get('tab'))
  const editOpen = searchParams.get('edit') === '1'

  useEffect(() => {
    const path = location.pathname
    if (path.endsWith('/ledger')) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'ledger')
      navigate({ pathname: `/customers/${id}`, search: `?${next.toString()}` }, { replace: true })
    } else if (path.endsWith('/edit')) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'details')
      next.set('edit', '1')
      navigate({ pathname: `/customers/${id}`, search: `?${next.toString()}` }, { replace: true })
    }
  }, [location.pathname, id, navigate, searchParams])

  const { data: customer, isLoading, error } = useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => getCustomer(id),
    enabled: Boolean(id),
  })

  const { data: summary } = useQuery({
    queryKey: ['pos-customer-summary', id],
    queryFn: () => getPosCustomerSummary(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteCustomer(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers-admin'] })
      navigate('/customers')
    },
  })

  const setTab = (nextTab: CustomerProfileTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    if (nextTab !== 'details') next.delete('edit')
    setSearchParams(next, { replace: true })
  }

  const setEditOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams)
    if (open) {
      next.set('tab', 'details')
      next.set('edit', '1')
    } else {
      next.delete('edit')
    }
    setSearchParams(next, { replace: true })
  }

  const shellDescription = useMemo(() => {
    if (!customer) return undefined
    const bits = [customer.phone, customer.email].filter(Boolean)
    return bits.length ? bits.join(' · ') : undefined
  }, [customer])

  const rating = summary
    ? {
        score: summary.rating,
        rating_status: summary.rating_status as 'unrated' | 'provisional' | 'rated',
      }
    : null

  if (isLoading) {
    return (
      <PageShell title="Customer" description="Loading…">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading customer…
        </div>
      </PageShell>
    )
  }

  if (error || !customer) {
    return (
      <PageShell title="Customer">
        <p className="text-sm text-[#E11D48]">Customer not found.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/customers">Back to customers</Link>
        </Button>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={customer.name}
      description={shellDescription}
      className="mx-auto max-w-6xl"
      contentClassName="space-y-4"
    >
      <CustomerProfileHeader
        customer={customer}
        rating={rating}
        onEdit={() => setEditOpen(true)}
        onSoftDelete={profile ? () => deleteMutation.mutate() : undefined}
      />

      <CustomerProfileTabs value={tab} onChange={setTab} panelIdPrefix={panelBaseId} />

      <div
        role="tabpanel"
        id={`${panelBaseId}-panel-${tab}`}
        aria-labelledby={`${panelBaseId}-${tab}`}
        className="min-h-[12rem]"
      >
        {tab === 'ledger' ? <CustomerLedgerTab customerId={customer.id} /> : null}
        {tab === 'orders' ? <CustomerOrdersTab customerId={customer.id} /> : null}
        {tab === 'details' ? (
          <CustomerDetailsTab
            customer={customer}
            editOpen={editOpen}
            onEditOpenChange={setEditOpen}
          />
        ) : null}
      </div>
    </PageShell>
  )
}

export const CustomerDetailPage = CustomerProfilePage
