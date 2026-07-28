import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import { useToast } from '@/components/ui/toast'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import { ProductForm } from '../components/ProductForm'

export function ProductNewPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()

  if (!profile?.organization_id) {
    return <p className="p-6 text-sm text-[#6B7280]">Loading organization…</p>
  }

  return (
    <ProductForm
      orgId={profile.organization_id}
      editing={null}
      title="Add new product"
      onSaved={async (id) => {
        await qc.invalidateQueries({ queryKey: ['products'] })
        invalidateStorefrontCache()
        toast('Product created')
        navigate(`/products/${id}/edit`, { replace: true })
      }}
      onError={(m) => toast(m, 'error')}
    />
  )
}
