import { Link } from 'react-router-dom'
import { brandConfig } from '@/config/brand'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6B7280]">{brandConfig.name}</p>
      <h1 className="mt-3 font-serif text-4xl text-[#111111]">Page not found</h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        The page you requested does not exist or has moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/"><Button className="rounded-full">Go to Storefront</Button></Link>
        <Link to="/dashboard"><Button variant="outline" className="rounded-full">Admin Dashboard</Button></Link>
      </div>
    </div>
  )
}
