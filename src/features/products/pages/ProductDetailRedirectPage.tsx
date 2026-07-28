import { Navigate, useParams } from 'react-router-dom'

export function ProductDetailRedirectPage() {
  const { id = '' } = useParams<{ id: string }>()
  return <Navigate to={`/products/${id}/edit`} replace />
}
