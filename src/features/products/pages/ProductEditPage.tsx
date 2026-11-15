import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-session'
import { useToast } from '@/components/ui/toast'
import { queryKeys } from '@/lib/query/keys'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import { ProductForm } from '../components/ProductForm'
import { getProduct } from '../repositories/catalog.repository'

export function ProductEditPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: product, isLoading, error } = useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => getProduct(id),
    enabled: Boolean(id),
  })

  if (!profile?.organization_id) {
    return <p className="p-6 text-sm text-[#6B7280]">Loading organization…</p>
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading product…
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-[#6B7280]">
          {error instanceof Error ? error.message : 'Product not found.'}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/products">Back to products</Link>
        </Button>
      </div>
    )
  }

  return (
    <ProductForm
      orgId={profile.organization_id}
      editing={product}
      title={product.name}
      onSaved={async () => {
        await qc.invalidateQueries({ queryKey: ['products'] })
        await qc.invalidateQueries({ queryKey: queryKeys.product(id) })
        await qc.invalidateQueries({ queryKey: ['pos-products'] })
        invalidateStorefrontCache()
        toast('Product updated')
        navigate('/products')
      }}
      onError={(m) => toast(m, 'error')}
    />
  )
}
