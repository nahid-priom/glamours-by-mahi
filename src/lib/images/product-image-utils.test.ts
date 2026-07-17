import { describe, expect, it } from 'vitest'
import {
  DEMO_PRODUCT_IMAGES,
  getStableDemoProductImage,
  resolveProductImage,
} from './product-image-utils'

describe('product image resolver', () => {
  it('keeps deterministic fallbacks stable', () => {
    const first = getStableDemoProductImage('0e793aef-1cec-4dbe-936d-271c2291a319')
    expect(getStableDemoProductImage('0e793aef-1cec-4dbe-936d-271c2291a319')).toBe(first)
    expect(DEMO_PRODUCT_IMAGES).toContain(first)
  })

  it('prefers authoritative image fields', () => {
    expect(
      resolveProductImage({
        id: 'product-1',
        primary_image_url: '/products/8.png',
        image_url: '/products/7.png',
        image: '/products/1.png',
      }),
    ).toBe('/products/8.png')

    expect(
      resolveProductImage({
        id: 'product-1',
        image_url: '/products/7.png',
        image: '/products/1.png',
      }),
    ).toBe('/products/7.png')
  })

  it('always resolves products without an image to a local demo asset', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(resolveProductImage({ id: `product-${index}` })).toMatch(/^\/products\/.+\.png$/)
    }
  })
})
