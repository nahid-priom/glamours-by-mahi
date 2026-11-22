import { describe, expect, it } from 'vitest'
import type { RouteObject } from 'react-router-dom'
import { salesRoutes } from './sales.routes'
import { settingsRoutes } from './settings.routes'
import { hrRoutes } from './hr.routes'
import { inventoryRoutes } from './inventory.routes'
import { customersRoutes } from './customers.routes'
import { suppliersRoutes } from './suppliers.routes'
import { productsRoutes } from './products.routes'
import { purchasesRoutes } from './purchases.routes'
import { accountsRoutes } from './accounts.routes'
import { administrationRoutes } from './administration.routes'
import { courierRoutes } from './courier.routes'
import { dashboardRoutes } from './dashboard.routes'
import { moderatorRoutes } from './moderator.routes'
import { reportsRoutes } from './reports.routes'
import { staffRoutes } from './staff.routes'
import { storefrontRoutes } from './storefront.routes'
import { printRoutes, publicInvoiceRoute } from './print.routes'

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

const ALL_MODULES: { name: string; routes: RouteObject | RouteObject[] }[] = [
  { name: 'storefront', routes: storefrontRoutes },
  { name: 'dashboard', routes: dashboardRoutes },
  { name: 'sales', routes: salesRoutes },
  { name: 'moderator', routes: moderatorRoutes },
  { name: 'staff', routes: staffRoutes },
  { name: 'products', routes: productsRoutes },
  { name: 'inventory', routes: inventoryRoutes },
  { name: 'purchases', routes: purchasesRoutes },
  { name: 'suppliers', routes: suppliersRoutes },
  { name: 'customers', routes: customersRoutes },
  { name: 'courier', routes: courierRoutes },
  { name: 'accounts', routes: accountsRoutes },
  { name: 'hr', routes: hrRoutes },
  { name: 'reports', routes: reportsRoutes },
  { name: 'administration', routes: administrationRoutes },
  { name: 'settings', routes: settingsRoutes },
  { name: 'print', routes: printRoutes },
  { name: 'public-invoice', routes: publicInvoiceRoute },
]

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
    expect(paths).toContain('/inventory/stock')
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

describe('reports route registration', () => {
  it('includes V3 cash-book and dues redirects plus live profit', () => {
    const paths = flattenPaths(reportsRoutes)
    expect(paths).toContain('/reports')
    expect(paths).toContain('/reports/profit')
    expect(paths).toContain('/reports/cash-book')
    expect(paths).toContain('/reports/dues')
    expect(paths).toContain('/reports/sales')
  })
})

describe('full route registry inventory', () => {
  it('flattens all domain modules and recounts live primary paths', () => {
    const allPaths = new Set<string>()
    for (const mod of ALL_MODULES) {
      for (const p of flattenPaths(mod.routes)) allPaths.add(p)
    }
    // Login + catch-all live in index.tsx (not domain modules)
    expect(allPaths.size).toBeGreaterThan(80)
    expect(allPaths.has('/inventory/stock')).toBe(true)
    expect(allPaths.has('/sales/pos')).toBe(true)
    expect(allPaths.has('/dashboard')).toBe(true)
    expect(allPaths.has('/reports/cash-book')).toBe(true)
    expect(allPaths.has('/reports/dues')).toBe(true)
  })

  it('does not register inventory stock view=suppliers as a separate path', () => {
    const paths = flattenPaths(inventoryRoutes)
    // Supplier provenance is a query tab, not a route — absence is expected
    expect(paths.every((p) => !p.includes('suppliers'))).toBe(true)
  })
})
