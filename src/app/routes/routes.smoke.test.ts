import { describe, expect, it } from 'vitest'
import { salesRoutes } from './sales.routes'

function flattenPaths(routes: typeof salesRoutes, prefix = ''): string[] {
  const paths: string[] = []
  for (const route of routes) {
    const p = route.path
    if (p) paths.push(prefix + p)
    if (route.children) {
      paths.push(...flattenPaths(route.children as typeof salesRoutes, prefix))
    }
  }
  return paths
}

describe('sales route registration', () => {
  it('includes commission settings and commissions paths', () => {
    const paths = flattenPaths(salesRoutes)
    expect(paths).toContain('/sales/commissions')
    expect(paths).toContain('/sales/commission-settings')
  })
})
