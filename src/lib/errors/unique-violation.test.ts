import { describe, expect, it } from 'vitest'
import { isUniqueViolation } from './unique-violation'
import { friendlyRpcError } from './rpc-error'

describe('isUniqueViolation', () => {
  it('detects Postgres 23505', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key' })).toBe(true)
  })

  it('detects HTTP 409 Conflict', () => {
    expect(isUniqueViolation({ status: 409, message: 'Conflict' })).toBe(true)
    expect(isUniqueViolation({ statusCode: '409', message: 'Conflict' })).toBe(true)
  })

  it('detects unique index message text', () => {
    expect(
      isUniqueViolation({
        message: 'duplicate key value violates unique constraint "categories_org_name_active_uidx"',
      }),
    ).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isUniqueViolation({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(new Error('network'))).toBe(false)
  })
})

describe('friendlyRpcError catalog duplicates', () => {
  it('maps category unique messages', () => {
    expect(
      friendlyRpcError({ message: 'A category with this name or code already exists.' }),
    ).toMatch(/category/i)
    expect(
      friendlyRpcError({
        message: 'duplicate key value violates unique constraint "categories_org_name_active_uidx"',
      }),
    ).toMatch(/category/i)
  })
})
