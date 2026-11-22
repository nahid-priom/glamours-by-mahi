import { describe, expect, it } from 'vitest'
import { formatSupplierPaymentRef } from '../purchases.repository'

describe('formatSupplierPaymentRef', () => {
  it('shortens SPAY hashes', () => {
    expect(formatSupplierPaymentRef('SPAY-abcdef0123456789abcdef01')).toBe('SPAY-ABCDEF01')
  })

  it('shortens raw UUIDs', () => {
    expect(formatSupplierPaymentRef('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('A1B2C3D4')
  })

  it('keeps short invoice numbers', () => {
    expect(formatSupplierPaymentRef('PO-000019')).toBe('PO-000019')
  })

  it('handles empty', () => {
    expect(formatSupplierPaymentRef(null)).toBe('—')
    expect(formatSupplierPaymentRef('')).toBe('—')
  })
})
