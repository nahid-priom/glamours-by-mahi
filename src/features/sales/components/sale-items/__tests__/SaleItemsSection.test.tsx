/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SaleItemsSection } from '../SaleItemsSection'
import { SaleItemMobileCard } from '../SaleItemMobileCard'
import { SaleItemsTable } from '../SaleItemsTable'
import { toSaleItemViewModel } from '../sale-item-presentation'
import type { SaleDetailLineItem } from '../sale-item.types'

vi.mock('@/components/common/ProductImage', () => ({
  ProductImage: ({ product }: { product: { name?: string } }) => (
    <img alt={product.name ?? 'Product'} data-testid="product-image" />
  ),
}))

function makeItem(
  overrides: Partial<SaleDetailLineItem> & {
    line_origin?: string | null
    product_variants?: SaleDetailLineItem['product_variants']
  } = {},
): SaleDetailLineItem {
  const { line_origin, product_variants, ...rest } = overrides
  return {
    id: 'item-1',
    sale_id: 'sale-1',
    variant_id: 'variant-1',
    batch_id: null,
    qty: 2,
    unit_price: 1500,
    line_total: 3000,
    line_discount: 0,
    cost_price: 0,
    organization_id: 'org-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    product_variants: product_variants ?? {
      sku: 'SKU-001',
      name: 'Rose',
      products: {
        id: 'prod-1',
        name: 'Urban Rose Crossbody Bag',
        image_url: null,
      },
    },
    ...rest,
    ...(line_origin !== undefined ? { line_origin } : {}),
  } as SaleDetailLineItem
}

describe('SaleItemsSection', () => {
  it('renders section title, product count, and line item fields', () => {
    render(<SaleItemsSection items={[makeItem()]} grandTotal={3000} />)

    expect(screen.getByRole('heading', { name: 'Items' })).toBeInTheDocument()
    expect(screen.getByText('1 Product')).toBeInTheDocument()
    // Card + table both mount; CSS container queries hide one in the browser.
    expect(screen.getAllByText('Urban Rose Crossbody Bag').length).toBe(2)
    expect(screen.getAllByText('SKU-001 · Rose').length).toBe(2)
    expect(screen.getByText('Qty 2')).toBeInTheDocument()
    expect(screen.getAllByText(/৳/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Grand total')).toBeInTheDocument()
  })

  it('renders empty state when there are no items', () => {
    render(<SaleItemsSection items={[]} />)
    expect(screen.getByText('No items on this sale.')).toBeInTheDocument()
    expect(screen.getByText('0 Products')).toBeInTheDocument()
  })

  it('handles missing optional metadata', () => {
    render(
      <SaleItemsSection
        items={[
          makeItem({
            product_variants: {
              sku: '',
              name: null,
              products: { id: 'p', name: 'Plain Bag', image_url: null },
            },
          }),
        ]}
      />,
    )
    expect(screen.getAllByText('Plain Bag').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('SKU-001')).not.toBeInTheDocument()
  })

  it('does not drop long product names', () => {
    const long =
      'Very Long Product Name That Should Wrap Across Multiple Lines Without Losing Data'
    render(
      <SaleItemsSection
        items={[
          makeItem({
            product_variants: {
              sku: 'SKU-LONG',
              name: 'XL',
              products: { id: 'p', name: long, image_url: null },
            },
          }),
        ]}
      />,
    )
    expect(screen.getAllByText(long).length).toBeGreaterThanOrEqual(1)
  })

  it('exposes equivalent business data in table and card presentations', () => {
    const item = makeItem({
      id: 'item-2',
      qty: 1.25,
      unit_price: 800,
      line_total: 1000,
      line_origin: 'exchange',
    })
    const vm = toSaleItemViewModel(item)

    const { rerender } = render(<SaleItemMobileCard item={vm} />)
    expect(screen.getByText('Urban Rose Crossbody Bag')).toBeInTheDocument()
    expect(screen.getByText('SKU-001 · Rose · exchange')).toBeInTheDocument()
    expect(screen.getByText('Qty 1.25')).toBeInTheDocument()
    expect(screen.getByText('Line total')).toBeInTheDocument()

    rerender(<SaleItemsTable items={[vm]} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Urban Rose Crossbody Bag')).toBeInTheDocument()
    expect(within(table).getByText('SKU-001 · Rose · exchange')).toBeInTheDocument()
    expect(within(table).getByText('1.25')).toBeInTheDocument()
  })

  it('mounts both layout roots for container-query switching', () => {
    render(<SaleItemsSection items={[makeItem()]} />)
    expect(screen.getByTestId('sale-items-cards')).toBeInTheDocument()
    expect(screen.getByTestId('sale-items-table')).toBeInTheDocument()
  })
})
