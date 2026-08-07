import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { listAccessibleBranches } from '@/features/inventory/repositories/inventory-valuation.repository'
import { listEmployees } from '@/features/hr/repositories/employees.repository'
import { createAdminUser, listAdminRoles } from '../repositories/administration.repository'

export function AdminUserInvitePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [defaultBranchId, setDefaultBranchId] = useState('')
  const [branchIds, setBranchIds] = useState<string[]>([])

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listAdminRoles,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['accessible-branches'],
    queryFn: listAccessibleBranches,
  })

  const { data: employeesData } = useQuery({
    queryKey: ['admin-create-employees'],
    queryFn: () => listEmployees({ status: 'active', pageSize: 200 }),
  })

  const unlinkedEmployees = useMemo(
    () => (employeesData?.items ?? []).filter((e) => !e.profile_id),
    [employeesData?.items],
  )

  const selectedEmployee = useMemo(
    () => unlinkedEmployees.find((e) => e.id === employeeId) ?? null,
    [unlinkedEmployees, employeeId],
  )

  const canSubmit = useMemo(() => {
    if (!employeeId || !roleId || !username.trim() || password.length < 8) return false
    if (password !== confirmPassword) return false
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username.trim())) return false
    if (branches.length > 0 && !defaultBranchId) return false
    if (branches.length > 0 && branchIds.length === 0) return false
    return true
  }, [
    employeeId,
    roleId,
    username,
    password,
    confirmPassword,
    defaultBranchId,
    branchIds,
    branches.length,
  ])

  function onEmployeeChange(id: string) {
    setEmployeeId(id)
    const emp = unlinkedEmployees.find((e) => e.id === id)
    if (emp?.branch_id) {
      setDefaultBranchId(emp.branch_id)
      setBranchIds((prev) => (prev.includes(emp.branch_id!) ? prev : [...prev, emp.branch_id!]))
    }
    if (emp && !username) {
      const suggestion = emp.employee_code
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 40)
      if (suggestion.length >= 3) setUsername(suggestion)
    }
  }

  function toggleBranch(id: string) {
    setBranchIds((prev) => {
      const next = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
      if (defaultBranchId && !next.includes(defaultBranchId)) {
        setDefaultBranchId(next[0] ?? '')
      }
      return next
    })
  }

  function onDefaultBranchChange(id: string) {
    setDefaultBranchId(id)
    if (id && !branchIds.includes(id)) {
      setBranchIds((prev) => [...prev, id])
    }
  }

  const createMut = useMutation({
    mutationFn: () => {
      const accessIds =
        branchIds.length > 0 ? branchIds : defaultBranchId ? [defaultBranchId] : []
      return createAdminUser({
        employee_id: employeeId,
        role_id: roleId,
        username: username.trim().toLowerCase(),
        password,
        default_branch_id: defaultBranchId || null,
        branch_ids: accessIds,
        email: selectedEmployee?.email ?? null,
      })
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast(`User created — login with username “${res.username}”`)
      navigate('/administration/users')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/administration/users">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Users
        </Link>
      </Button>
      <h1 className="text-xl font-bold">Create staff user</h1>
      <p className="text-sm text-[#6B7280]">
        Pick an Employee, assign a Role, then set Username and Password. They can sign in to the
        dashboard immediately — password is stored only in Supabase Auth.
      </p>

      <PermissionGate
        permission={['administration.users.create', 'settings.manage']}
        fallback={
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            You need permission to create users.
          </p>
        }
      >
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-employee">Employee</Label>
            <select
              id="create-employee"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={employeeId}
              onChange={(e) => onEmployeeChange(e.target.value)}
              required
            >
              <option value="">Select employee…</option>
              {unlinkedEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code})
                  {e.email ? ` · ${e.email}` : ''}
                </option>
              ))}
            </select>
            {unlinkedEmployees.length === 0 ? (
              <p className="text-xs text-[#6B7280]">
                No unlinked active employees. Create an employee in HR first, or unlink an existing
                account.
              </p>
            ) : null}
            {selectedEmployee ? (
              <p className="text-xs text-[#6B7280]">
                {selectedEmployee.full_name}
                {selectedEmployee.phone ? ` · ${selectedEmployee.phone}` : ''}
                {selectedEmployee.designation ? ` · ${selectedEmployee.designation}` : ''}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-username">Username</Label>
            <Input
              id="create-username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="e.g. sadia.mod"
              required
            />
            <p className="text-[11px] text-[#9CA3AF]">3–40 characters: a–z, 0–9, . _ -</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-confirm">Confirm password</Label>
              <Input
                id="create-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
          {password && confirmPassword && password !== confirmPassword ? (
            <p className="text-xs text-[#E11D48]">Passwords do not match</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="create-role">Role</Label>
            <select
              id="create-role"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
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
                <Label htmlFor="create-default-branch">Default branch</Label>
                <select
                  id="create-default-branch"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
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
                <p className="text-xs text-[#6B7280]">
                  Select one or more branches this user can operate in.
                </p>
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

          <Button
            disabled={createMut.isPending || !canSubmit}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </PermissionGate>
    </div>
  )
}
