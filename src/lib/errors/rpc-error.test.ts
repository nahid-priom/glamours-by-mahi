import { describe, expect, it } from 'vitest'
import { friendlyRpcError } from '@/lib/errors/rpc-error'

describe('friendlyRpcError', () => {
  it('maps due customer requirement', () => {
    expect(friendlyRpcError(new Error('Due payment requires a customer'))).toBe(
      'Customer is required for a due sale.',
    )
  })

  it('maps collection overage', () => {
    expect(
      friendlyRpcError(new Error('Collection amount 500 exceeds customer due 100')),
    ).toBe('Collection amount cannot exceed customer due.')
  })

  it('truncates opaque uuid errors', () => {
    expect(friendlyRpcError(new Error('550e8400-e29b-41d4-a716-446655440000'))).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
