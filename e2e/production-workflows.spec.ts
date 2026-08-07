import { test } from '@playwright/test'

/**
 * Production workflow acceptance checklist (manual / authenticated env).
 * These are documented as skipped placeholders so CI stays green without secrets;
 * enable when E2E credentials and seeded branches are available.
 */
const workflows = [
  'Walk-in cash sale',
  'Walk-in due sale and later collection',
  'Online COD order to courier settlement',
  'Purchase to supplier payment',
  'Product exchange with price difference',
  'Branch transfer with partial receive',
  'Attendance to payroll',
  'Sale commission approval and payment',
] as const

for (const name of workflows) {
  test.skip(`workflow: ${name}`, async () => {
    // Intentionally skipped until authenticated E2E seed is wired.
  })
}
