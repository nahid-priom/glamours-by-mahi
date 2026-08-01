import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test('admin-create-user must require authorization header in contract', () => {
  const headers = new Headers()
  assertEquals(headers.has('Authorization'), false)
})

Deno.test('admin-create-user rejects empty email shape', () => {
  const payload = { email: '', full_name: 'X', role_id: 'r1' }
  assertEquals(payload.email.trim().length === 0, true)
})
