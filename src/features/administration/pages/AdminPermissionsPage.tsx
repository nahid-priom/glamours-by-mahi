import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { settingsService } from '@/features/settings/settings.service'
import type { RoleEntry } from '@/features/settings/settings.types'
import { toastRpcError } from '@/lib/errors/rpc-error'

function isLockedRole(role: RoleEntry) {
  const n = role.name.trim().toLowerCase()
  return n === 'super admin' || n === 'owner' || Boolean(role.is_system && (n === 'super admin' || n === 'owner'))
}

export function AdminPermissionsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [roleId, setRoleId] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-settings-roles'],
    queryFn: () => settingsService.getSettings(),
  })

  const roles = data?.roles.filter((r) => r.is_active) ?? []
  const activeRole = roles.find((r) => r.id === roleId) ?? null
  const locked = activeRole ? isLockedRole(activeRole) : false

  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const key of PERMISSIONS) {
      const module = key.split('.')[0] ?? 'other'
      const list = map.get(module) ?? []
      list.push(key)
      map.set(module, list)
    }
    return Array.from(map.entries())
  }, [])

  const save = useMutation({
    mutationFn: async () => {
      if (!activeRole) throw new Error('Select a role')
      if (locked) throw new Error('Owner / Super Admin cannot be edited here')
      return settingsService.updateRole(activeRole.id, {
        name: String(activeRole.name),
        description: activeRole.description || activeRole.name,
        permissions: selected,
        is_active: true,
      })
    },
    onSuccess: () => {
      toast('Role permissions updated — navigation and RPC/RLS use these keys')
      void qc.invalidateQueries({ queryKey: ['admin-settings-roles'] })
      void qc.invalidateQueries({ queryKey: ['permissions'] })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/administration">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Administration
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold">Permissions</h1>
        <p className="text-sm text-[#6B7280]">
          {PERMISSIONS.length} keys enforced by RLS, RPC, routes, and sidebar. Assign via roles —
          hiding buttons alone is not authorization.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-[#E11D48]">{(error as Error).message}</p>
      ) : null}
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading roles…</p> : null}

      <PermissionGate permission="settings.manage">
        <div className="space-y-3 rounded-2xl border bg-white p-4">
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#6B7280]">Role</span>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={roleId}
              onChange={(e) => {
                const id = e.target.value
                setRoleId(id)
                const role = roles.find((r) => r.id === id)
                setSelected(role?.permissions.filter((p) => p !== '*') ?? [])
              }}
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {isLockedRole(r) ? ' (locked)' : ''}
                </option>
              ))}
            </select>
          </label>

          {activeRole && locked ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Owner / Super Admin roles are locked. Create a custom role to grant a subset of
              permissions.
            </p>
          ) : null}

          {activeRole && !locked ? (
            <>
              <div className="max-h-[420px] space-y-4 overflow-y-auto rounded-xl border p-3">
                {groups.map(([module, keys]) => (
                  <div key={module}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      {module}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {keys.map((key) => (
                        <label key={key} className="flex items-start gap-2 text-xs">
                          <Checkbox
                            checked={selected.includes(key)}
                            onCheckedChange={() =>
                              setSelected((prev) =>
                                prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
                              )
                            }
                          />
                          <span className="font-mono leading-snug">{key}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#6B7280]">{selected.length} selected</p>
                <Button
                  disabled={save.isPending || selected.length === 0}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? 'Saving…' : 'Save permissions'}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </PermissionGate>

      <p className="text-xs text-[#6B7280]">
        Also available under <Link className="text-[#E11D48]" to="/settings">Settings → Roles</Link>.
        After save, affected users must refresh session / re-login to pick up new keys.
      </p>
    </div>
  )
}
