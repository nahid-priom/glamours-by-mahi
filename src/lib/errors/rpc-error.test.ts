import { describe, expect, it, vi } from 'vitest'
import { extractErrorText, friendlyRpcError, toastRpcError } from '@/lib/errors/rpc-error'

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

  it('maps PostgREST 409 unique violation (23505)', () => {
    const err = Object.assign(new Error('duplicate key value violates unique constraint "categories_org_name_uidx"'), {
      code: '23505',
      details: 'Key (org_id, name)=(...) already exists.',
    })
    expect(friendlyRpcError(err)).toBe(
      'This record already exists. Please use a different name or code.',
    )
  })

  it('maps RLS / permission denied (42501)', () => {
    const err = Object.assign(new Error('new row violates row-level security policy'), {
      code: '42501',
    })
    expect(friendlyRpcError(err)).toBe('You do not have permission to perform this action.')
  })

  it('prefers short human-readable RPC raise messages', () => {
    expect(friendlyRpcError(new Error('Barcode already assigned to another product'))).toBe(
      'Barcode already assigned to another product',
    )
  })

  it('maps catalog duplicate raise text', () => {
    expect(friendlyRpcError(new Error('A category with this name or code already exists'))).toBe(
      'A category with this name or code already exists.',
    )
  })

  it('extracts PostgREST object message', () => {
    expect(
      extractErrorText({
        message: 'JWT expired',
        code: 'PGRST301',
      }),
    ).toBe('JWT expired')
    expect(friendlyRpcError({ message: 'JWT expired', code: 'PGRST301' })).toBe(
      'Your session has expired. Please sign in again.',
    )
  })

  it('falls back for SQL stack noise', () => {
    expect(
      friendlyRpcError(
        new Error('ERROR: boom\nCONTEXT: PL/pgSQL function foo() line 12 at RAISE\nSQLSTATE: P0001'),
      ),
    ).toBe('Something went wrong. Please try again.')
  })
})

describe('toastRpcError', () => {
  it('toasts the friendly message as error', () => {
    const toast = vi.fn()
    toastRpcError(toast, new Error('insufficient stock for sku X'), 'Could not save.')
    expect(toast).toHaveBeenCalledWith('Insufficient stock for one or more items.', 'error')
  })
})
