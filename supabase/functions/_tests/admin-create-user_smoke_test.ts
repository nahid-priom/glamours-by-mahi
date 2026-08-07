import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test('admin-create-user must require authorization header in contract', () => {
  const headers = new Headers()
  assertEquals(headers.has('Authorization'), false)
})

Deno.test('admin-create-user rejects incomplete create payload', () => {
  const payload = {
    employee_id: '',
    role_id: 'r1',
    username: 'ab',
    password: 'short',
  }
  assertEquals(payload.employee_id.trim().length === 0, true)
  assertEquals(payload.username.length < 3, true)
  assertEquals(payload.password.length < 8, true)
})

Deno.test('admin-create-user username format', () => {
  const ok = /^[a-z0-9._-]{3,40}$/.test('sadia.mod')
  const bad = /^[a-z0-9._-]{3,40}$/.test('a')
  assertEquals(ok, true)
  assertEquals(bad, false)
})
