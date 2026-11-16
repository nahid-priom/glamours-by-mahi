import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import { useToast } from '@/components/ui/toast'
import { invalidateInventoryQueries } from '@/features/inventory/lib/invalidate-inventory-queries'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import { ProductCreateWizard } from '../components/wizard/ProductCreateWizard'

export function ProductNewPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()

  if (!profile?.organization_id) {
    return <p className="p-6 text-sm text-[#6B7280]">Loading organization…</p>
  }

  return (
    <ProductCreateWizard
      orgId={profile.organization_id}
      onError={(m) => toast(m, 'error')}
      onCreated={async () => {
        invalidateInventoryQueries(qc)
        invalidateStorefrontCache()
      }}
    />
  )
}
