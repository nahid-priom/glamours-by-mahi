import { useEffect, useId, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/features/auth/auth-session'
import { getSupplierRating, refreshSupplierRating } from '@/features/supplier-rating'
import { queryKeys } from '@/lib/query/keys'
import { SupplierProfileHeader } from '../components/SupplierProfileHeader'
import { SupplierProfileTabs } from '../components/SupplierProfileTabs'
import { SupplierDetailsTab } from '../details/SupplierDetailsTab'
import { SupplierLedgerTab } from '../ledger/SupplierLedgerTab'
import { SupplierStockTab } from '../stock/SupplierStockTab'
import type { SupplierProfileTab } from '../types/supplier-360.types'
import { getSupplier, softDeleteSupplier } from '../repositories/suppliers.repository'

function parseTab(value: string | null): SupplierProfileTab {
  if (value === 'stock' || value === 'details' || value === 'ledger') return value
  return 'ledger'
}

export function SupplierProfilePage() {
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
      navigate({ pathname: `/suppliers/${id}`, search: `?${next.toString()}` }, { replace: true })
    } else if (path.endsWith('/edit')) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'details')
      next.set('edit', '1')
      navigate({ pathname: `/suppliers/${id}`, search: `?${next.toString()}` }, { replace: true })
    }
  }, [location.pathname, id, navigate, searchParams])

  const { data: supplier, isLoading, error } = useQuery({
    queryKey: queryKeys.supplier(id),
    queryFn: () => getSupplier(id),
    enabled: Boolean(id),
  })

  const { data: rating } = useQuery({
    queryKey: [...queryKeys.supplier(id), 'rating'],
    queryFn: async () => {
      const existing = await getSupplierRating(id)
      if (existing) return existing
      return refreshSupplierRating(id)
    },
    enabled: Boolean(id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteSupplier(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
      navigate('/suppliers')
    },
  })

  const setTab = (nextTab: SupplierProfileTab) => {
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
    if (!supplier) return undefined
    const bits = [supplier.phone, supplier.email].filter(Boolean)
    return bits.length ? bits.join(' · ') : undefined
  }, [supplier])

  if (isLoading) {
    return (
      <PageShell title="Supplier" description="Loading…">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading supplier…
        </div>
      </PageShell>
    )
  }

  if (error || !supplier) {
    return (
      <PageShell title="Supplier">
        <p className="text-sm text-[#E11D48]">Supplier not found.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/suppliers">Back to directory</Link>
        </Button>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={supplier.name}
      description={shellDescription}
      className="mx-auto max-w-6xl"
      contentClassName="space-y-4"
    >
      <SupplierProfileHeader
        supplier={supplier}
        rating={rating ?? null}
        onEdit={() => setEditOpen(true)}
        onSoftDelete={profile ? () => deleteMutation.mutate() : undefined}
      />

      <SupplierProfileTabs value={tab} onChange={setTab} panelIdPrefix={panelBaseId} />

      <div
        role="tabpanel"
        id={`${panelBaseId}-panel-${tab}`}
        aria-labelledby={`${panelBaseId}-${tab}`}
        className="min-h-[12rem]"
      >
        {tab === 'ledger' ? <SupplierLedgerTab supplierId={supplier.id} /> : null}
        {tab === 'stock' ? <SupplierStockTab supplierId={supplier.id} /> : null}
        {tab === 'details' ? (
          <SupplierDetailsTab supplier={supplier} editOpen={editOpen} onEditOpenChange={setEditOpen} />
        ) : null}
      </div>

    </PageShell>
  )
}

export const SupplierDetailPage = SupplierProfilePage