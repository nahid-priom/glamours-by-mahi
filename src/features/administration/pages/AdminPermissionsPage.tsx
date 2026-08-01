import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/lib/permissions/catalog'

export function AdminPermissionsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/administration">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Administration
        </Link>
      </Button>
      <h1 className="text-xl font-bold">Permissions catalog</h1>
      <p className="text-sm text-[#6B7280]">{PERMISSIONS.length} keys enforced by RLS, RPC, and routes.</p>
      <ul className="max-h-[480px] divide-y overflow-y-auto rounded-xl border bg-white text-sm">
        {PERMISSIONS.map((key) => (
          <li key={key} className="px-4 py-2 font-mono text-xs">
            {key}
          </li>
        ))}
      </ul>
    </div>
  )
}
