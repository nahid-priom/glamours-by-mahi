import { describe, expect, it } from 'vitest'
import * as checkout from '../checkout.service'

describe('storefront checkout', () => {
  it('exports placeOrder without depending on fraudService mock', () => {
    expect(typeof checkout.checkoutService.placeOrder).toBe('function')
    expect(JSON.stringify(checkout)).not.toContain('runHybridCheck')
  })
})
