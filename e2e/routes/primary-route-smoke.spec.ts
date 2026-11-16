import { expect, test } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner } from '../helpers/auth'

const env = getQaEnv()

type ManifestRoute = {
  path: string
  kind: string
  dynamic_params: string[]
}

function loadPrimaryStaticRoutes(): string[] {
  const manifestPath = resolve(process.cwd(), 'tests/contracts/route-manifest.json')
  if (!existsSync(manifestPath)) return []
  const data = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    routes: ManifestRoute[]
  }
  return data.routes
    .filter((r) => r.kind === 'primary' && r.dynamic_params.length === 0)
    .map((r) => r.path)
    .filter((p) => !p.includes('*'))
}

const PUBLIC_PREFIXES = [
  '/',
  '/shop',
  '/cart',
  '/checkout',
  '/search',
  '/offline',
  '/track-order',
  '/category',
  '/product',
  '/account',
  '/public',
]

function isPublicPath(path: string): boolean {
  if (path === '/') return true
  return PUBLIC_PREFIXES.some((p) => p !== '/' && (path === p || path.startsWith(p + '/')))
}

const staticPrimaries = loadPrimaryStaticRoutes()

test.describe('Primary route happy-path smoke', () => {
  test('route manifest has primary routes', () => {
    expect(staticPrimaries.length, 'Run npm run qa:routes first').toBeGreaterThan(40)
  })

  test('public static primaries load without 5xx', async ({ page }) => {
    const fromManifest = staticPrimaries.filter(isPublicPath)
    const fallback = [
      '/',
      '/shop',
      '/cart',
      '/checkout',
      '/search',
      '/offline',
      '/track-order',
      '/admin/login',
    ]
    const paths = fromManifest.length > 5 ? fromManifest : fallback
    expect(paths.length).toBeGreaterThan(5)
    const failures: string[] = []
    for (const path of paths) {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
      if ((res?.status() ?? 200) >= 500) failures.push(`${path} status=${res?.status()}`)
      try {
        await expect(page.locator('body')).toBeVisible({ timeout: 15_000 })
      } catch {
        failures.push(`${path} body not visible`)
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
  })

  test('authenticated static primaries load without crash', async ({ page }) => {
    test.skip(!env.authReady, authBlockedMessage())
    test.setTimeout(300_000)
    await loginAsOwner(page)
    const adminPaths = staticPrimaries.filter((p) => !isPublicPath(p) && p !== '/admin/login')
    expect(adminPaths.length).toBeGreaterThan(20)
    const failures: string[] = []
    for (const path of adminPaths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      try {
        await expect(page.locator('body')).toBeVisible({ timeout: 20_000 })
      } catch {
        failures.push(path)
      }
    }
    expect(failures, `Crashed/blank routes:\n${failures.join('\n')}`).toEqual([])
  })
})

test.describe('Redirect aliases', () => {
  test.skip(!env.authReady, authBlockedMessage())

  test('/inventory redirects to /inventory/stock', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/inventory')
    await expect(page).toHaveURL(/\/inventory\/stock/)
  })

  test('/inventory/branch-stock redirects to /inventory/stock', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/inventory/branch-stock')
    await expect(page).toHaveURL(/\/inventory\/stock/)
  })
})
