import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import {
  getAdminUserDetail,
  listAdminRoles,
  updateAdminUser,
} from '../repositories/administration.repository'

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [isActive, setIsActive] = useState(true)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getAdminUserDetail(id),
    enabled: Boolean(id),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listAdminRoles,
  })

  useEffect(() => {
    if (!data) return
    setFullName(data.full_name ?? '')
    setPhone(data.phone ?? '')
    setRoleId(data.role_id ?? '')
    setIsActive(Boolean(data.is_active))
  }, [data])

  const saveMut = useMutation({
    mutationFn: () =>
      updateAdminUser({
        user_id: id,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role_id: roleId || null,
        is_active: isActive,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-user', id] })
      await qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast('User updated')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    )
  }

  if (error || !data) {
    return <p className="text-sm text-[#E11D48]">User not found.</p>
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/administration/users">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Users
        </Link>
      </Button>
      <h1 className="text-xl font-bold">{data.full_name}</h1>
      <p className="text-sm text-[#6B7280]">{data.email}</p>

      <dl className="space-y-2 rounded-xl border bg-white p-4 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6B7280]">Branches</dt>
          <dd>{data.branch_ids?.length ?? 0}</dd>
        </div>
      </dl>

      <PermissionGate permission={['administration.users.update', 'settings.manage']}>
        <form
          className="space-y-3 rounded-xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveMut.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <Button type="submit" disabled={saveMut.isPending}>
            {saveMut.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </PermissionGate>
    </div>
  )
}
