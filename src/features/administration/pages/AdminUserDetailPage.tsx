import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { listAccessibleBranches } from '@/features/inventory/repositories/inventory-valuation.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  getAdminUserDetail,
  listAdminRoles,
  resetAdminUserPassword,
  updateAdminUser,
} from '../repositories/administration.repository'

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [defaultBranchId, setDefaultBranchId] = useState('')
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getAdminUserDetail(id),
    enabled: Boolean(id),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listAdminRoles,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['accessible-branches'],
    queryFn: listAccessibleBranches,
  })

  useEffect(() => {
    if (!data) return
    setFullName(data.full_name ?? '')
    setPhone(data.phone ?? '')
    setRoleId(data.role_id ?? '')
    setDefaultBranchId(data.default_branch_id ?? '')
    setBranchIds(Array.isArray(data.branch_ids) ? data.branch_ids.map(String) : [])
    setIsActive(Boolean(data.is_active))
  }, [data])

  const canSave = useMemo(() => {
    if (!fullName.trim() || !roleId) return false
    if (branches.length > 0 && !defaultBranchId) return false
    if (branches.length > 0 && branchIds.length === 0) return false
    return true
  }, [fullName, roleId, defaultBranchId, branchIds, branches.length])

  const canReset = newPassword.length >= 8 && newPassword === confirmPassword

  function toggleBranch(branchId: string) {
    setBranchIds((prev) => {
      const next = prev.includes(branchId)
        ? prev.filter((b) => b !== branchId)
        : [...prev, branchId]
      if (defaultBranchId && !next.includes(defaultBranchId)) {
        setDefaultBranchId(next[0] ?? '')
      }
      return next
    })
  }

  function onDefaultBranchChange(branchId: string) {
    setDefaultBranchId(branchId)
    if (branchId && !branchIds.includes(branchId)) {
      setBranchIds((prev) => [...prev, branchId])
    }
  }

  const saveMut = useMutation({
    mutationFn: () =>
      updateAdminUser({
        user_id: id,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role_id: roleId || null,
        default_branch_id: defaultBranchId || null,
        branch_ids: branchIds,
        is_active: isActive,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-user', id] })
      await qc.invalidateQueries({ queryKey: ['admin-users'] })
      await qc.invalidateQueries({ queryKey: ['accessible-branches'] })
      await qc.invalidateQueries({ queryKey: ['dashboard-branches'] })
      // If editing the signed-in user, refresh session grants immediately.
      if (profile?.id === id) {
        await refreshProfile()
      }
      toast('User updated')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const resetMut = useMutation({
    mutationFn: () => resetAdminUserPassword(id, newPassword),
    onSuccess: () => {
      setNewPassword('')
      setConfirmPassword('')
      toast('Password reset successfully')
    },
    onError: (e: Error) => toastRpcError(toast, e),
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
      <div>
        <h1 className="text-xl font-bold">{data.full_name}</h1>
        <p className="text-sm text-[#6B7280]">
          {data.username ? (
            <>
              Username <span className="font-medium text-[#111827]">{data.username}</span>
              {' · '}
            </>
          ) : null}
          {data.email}
        </p>
        {data.employee_name ? (
          <p className="mt-1 text-xs text-[#6B7280]">
            Linked employee: {data.employee_name}
            {data.employee_code ? ` (${data.employee_code})` : ''}
          </p>
        ) : (
          <p className="mt-1 text-xs text-[#9CA3AF]">No linked employee</p>
        )}
      </div>

      <PermissionGate permission={['administration.users.update', 'settings.manage']}>
        <form
          className="space-y-3 rounded-xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSave) return
            saveMut.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="detail-name">Full name</Label>
            <Input
              id="detail-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-phone">Phone</Label>
            <Input
              id="detail-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-role">Role</Label>
            <select
              id="detail-role"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.description ? ` — ${r.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          {branches.length > 0 ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="detail-default-branch">Default branch</Label>
                <select
                  id="detail-default-branch"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={defaultBranchId}
                  onChange={(e) => onDefaultBranchChange(e.target.value)}
                  required
                >
                  <option value="">Select default branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.code ? ` (${b.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Branch access</legend>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={branchIds.includes(b.id)}
                        onChange={() => toggleBranch(b.id)}
                      />
                      <span>
                        {b.name}
                        {b.code ? (
                          <span className="text-[#6B7280]"> ({b.code})</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <Button type="submit" disabled={saveMut.isPending || !canSave}>
            {saveMut.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </PermissionGate>

      <PermissionGate permission={['administration.users.reset_password', 'settings.manage']}>
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <div>
            <p className="text-sm font-semibold">Reset password</p>
            <p className="text-xs text-[#6B7280]">
              Set a new password for this user. They can sign in immediately with username or email.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm">Confirm</Label>
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword ? (
            <p className="text-xs text-[#E11D48]">Passwords do not match</p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={resetMut.isPending || !canReset}
            onClick={() => resetMut.mutate()}
          >
            {resetMut.isPending ? 'Resetting…' : 'Reset password'}
          </Button>
        </div>
      </PermissionGate>
    </div>
  )
}
