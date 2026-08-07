import { describe, expect, it } from 'vitest'

/** Mirrors AdminUserInvitePage payload assembly for smoke coverage. */
function buildCreateUserPayload(input: {
  employee_id: string
  role_id: string
  username: string
  password: string
  default_branch_id: string
  branch_ids: string[]
}) {
  const accessIds =
    input.branch_ids.length > 0
      ? input.branch_ids
      : input.default_branch_id
        ? [input.default_branch_id]
        : []
  return {
    employee_id: input.employee_id,
    role_id: input.role_id,
    username: input.username.trim().toLowerCase(),
    password: input.password,
    default_branch_id: input.default_branch_id || null,
    branch_ids: accessIds,
  }
}

describe('admin create staff user payload', () => {
  it('includes employee, role, username and branch_ids', () => {
    const payload = buildCreateUserPayload({
      employee_id: 'emp-1',
      role_id: 'role-moderator',
      username: 'Sadia.Mod',
      password: 'secret123',
      default_branch_id: 'branch-a',
      branch_ids: ['branch-a', 'branch-b'],
    })
    expect(payload.employee_id).toBe('emp-1')
    expect(payload.role_id).toBe('role-moderator')
    expect(payload.username).toBe('sadia.mod')
    expect(payload.default_branch_id).toBe('branch-a')
    expect(payload.branch_ids).toEqual(['branch-a', 'branch-b'])
  })

  it('falls back to default branch when access list empty', () => {
    const payload = buildCreateUserPayload({
      employee_id: 'emp-2',
      role_id: 'role-sales',
      username: 'sales.user',
      password: 'secret123',
      default_branch_id: 'branch-a',
      branch_ids: [],
    })
    expect(payload.branch_ids).toEqual(['branch-a'])
  })
})
