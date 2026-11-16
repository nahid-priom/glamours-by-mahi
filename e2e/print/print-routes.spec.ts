import { expect, test } from '@playwright/test'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner } from '../helpers/auth'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const env = getQaEnv()

function printStaticPaths(): string[] {
  const manifestPath = resolve(process.cwd(), 'tests/contracts/route-manifest.json')
  if (!existsSync(manifestPath)) return []
  const data = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    routes: { path: string; kind: string; dynamic_params: string[]; module: string }[]
  }
  return data.routes
    .filter(
      (r) =>
        r.kind === 'primary' &&
        r.dynamic_params.length === 0 &&
        (r.path.startsWith('/print') || r.module === 'print'),
    )
    .map((r) => r.path)
}

test.describe('Print / export shells', () => {
  test.skip(!env.authReady, authBlockedMessage())

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
  })

  test('static print routes render without crash', async ({ page }) => {
    const paths = printStaticPaths()
    test.skip(paths.length === 0, 'No static print paths in manifest')
    for (const path of paths.slice(0, 15)) {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('reports module export entry', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.locator('body')).toBeVisible()
  })
})
