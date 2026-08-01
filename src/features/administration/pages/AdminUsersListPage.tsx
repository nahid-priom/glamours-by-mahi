import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listAdminUsers } from '../repositories/administration.repository'

export function AdminUsersListPage() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => listAdminUsers(search),
  })

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/administration">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Administration
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Users</h1>
        </div>
        <Button asChild size="sm">
          <Link to="/administration/users/new">Invite user</Link>
        </Button>
      </div>

      <Input
        placeholder="Search name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load users.</p> : null}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link className="font-medium hover:underline" to={`/administration/users/${u.id}`}>
                    {u.full_name}
                  </Link>
                </td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.role_name ?? '—'}</td>
                <td className="px-3 py-2">{u.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
