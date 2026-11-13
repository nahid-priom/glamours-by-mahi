import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listAdminRoles } from '../repositories/administration.repository'

export function AdminRolesPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listAdminRoles,
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/administration">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Administration
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Roles</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/administration/permissions">Edit permissions</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/settings">Create roles in Settings</Link>
          </Button>
        </div>
      </div>
      <p className="text-sm text-[#6B7280]">
        Role templates are listed here. Assign keys under Administration → Permissions, or create
        roles under Settings → Roles. Writes require settings.manage.
      </p>
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      <ul className="divide-y rounded-xl border bg-white">
        {data.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{r.name}</span>
              {r.description ? (
                <span className="mt-0.5 block text-xs text-[#6B7280]">{r.description}</span>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">{r.permission_count} permissions</span>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link to="/administration/permissions">Manage</Link>
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
