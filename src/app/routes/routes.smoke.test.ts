import { describe, expect, it } from 'vitest'
import type { RouteObject } from 'react-router-dom'
import { salesRoutes } from './sales.routes'
import { settingsRoutes } from './settings.routes'
import { hrRoutes } from './hr.routes'
import { inventoryRoutes } from './inventory.routes'
import { customersRoutes } from './customers.routes'
import { suppliersRoutes } from './suppliers.routes'
import { productsRoutes } from './products.routes'

function flattenPaths(routes: RouteObject | RouteObject[], prefix = ''): string[] {
  const list = Array.isArray(routes) ? routes : [routes]
  const paths: string[] = []
  for (const route of list) {
    const p = route.path
    if (p) paths.push(prefix + p)
    if (route.children) {
      paths.push(...flattenPaths(route.children, prefix))
    }
  }
  return paths
}

describe('sales route registration', () => {
  it('includes commission, exchanges, online orders and POS paths', () => {
    const paths = flattenPaths(salesRoutes)
    expect(paths).toContain('/sales/commissions')
    expect(paths).toContain('/sales/commission-settings')
    expect(paths).toContain('/sales/pos')
    expect(paths).toContain('/sales/online-orders')
    expect(paths).toContain('/sales/exchanges')
    expect(paths).toContain('/sales/returns')
  })
})

describe('settings route registration', () => {
  it('includes activity logs and data reset paths', () => {
    const paths = flattenPaths(settingsRoutes)
    expect(paths).toContain('/activity-logs')
    expect(paths).toContain('/settings/data-reset')
  })
})

describe('hr route registration', () => {
  it('includes commission settings under hr', () => {
    const paths = flattenPaths(hrRoutes)
    expect(paths).toContain('/hr/commissions')
    expect(paths).toContain('/hr/commission-settings')
  })
})

describe('inventory route registration', () => {
  it('includes ledger and stock overview', () => {
    const paths = flattenPaths(inventoryRoutes)
    expect(paths).toContain('/inventory/ledger')
    expect(paths).toContain('/inventory')
  })
})

describe('customers route registration', () => {
  it('includes customer detail and import routes', () => {
    const paths = flattenPaths(customersRoutes)
    expect(paths).toContain('/customers')
    expect(paths).toContain('/customers/:id')
    expect(paths).toContain('/customers/import')
  })
})

describe('suppliers route registration', () => {
  it('includes supplier import route', () => {
    const paths = flattenPaths(suppliersRoutes)
    expect(paths).toContain('/suppliers')
    expect(paths).toContain('/suppliers/import')
  })
})

describe('products route registration', () => {
  it('includes product import route', () => {
    const paths = flattenPaths(productsRoutes)
    expect(paths).toContain('/products/import')
  })
})
