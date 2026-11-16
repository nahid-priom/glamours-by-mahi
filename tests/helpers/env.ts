/**
 * Shared env helpers for Playwright and Node QA scripts.
 * Never log password values.
 */

export type QaEnv = {
  email: string
  password: string
  baseURL: string
  testEnvironmentId: string
  testRunId: string
  mutatingAllowed: boolean
  authReady: boolean
}

const PRODUCTION_DENYLIST = new Set([
  'production',
  'prod',
  'live',
  'main-prod',
  'mahi-production',
])

export function getOwnerCredentials(): { email: string; password: string } {
  const email =
    process.env.OWNER_EMAIL ??
    process.env.E2E_OWNER_EMAIL ??
    process.env.E2E_ADMIN_EMAIL ??
    process.env.E2E_EMAIL ??
    ''
  const password =
    process.env.OWNER_PASSWORD ??
    process.env.E2E_OWNER_PASSWORD ??
    process.env.E2E_ADMIN_PASSWORD ??
    process.env.E2E_PASSWORD ??
    ''
  return { email, password }
}

export function getQaEnv(): QaEnv {
  const { email, password } = getOwnerCredentials()
  const envId = (process.env.TEST_ENVIRONMENT_ID ?? '').trim().toLowerCase()
  const baseURL =
    process.env.E2E_BASE_URL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    'http://localhost:5173'
  const allowMutating =
    String(process.env.ALLOW_MUTATING_E2E ?? '').toLowerCase() === 'true'
  const looksLocal =
    /localhost|127\.0\.0\.1/.test(baseURL) ||
    envId === 'local' ||
    envId.startsWith('local-')
  const looksStaging =
    envId.startsWith('staging') ||
    envId.startsWith('test') ||
    envId.startsWith('qa') ||
    envId.includes('sandbox')
  const mutatingAllowed =
    allowMutating &&
    Boolean(envId) &&
    !PRODUCTION_DENYLIST.has(envId) &&
    (looksLocal || looksStaging)

  return {
    email,
    password,
    baseURL,
    testEnvironmentId: envId,
    testRunId: process.env.TEST_RUN_ID ?? 'local-dev',
    mutatingAllowed,
    authReady: Boolean(email && password),
  }
}

export function requireAuthReady(): QaEnv {
  const env = getQaEnv()
  if (!env.authReady) {
    throw new Error(
      'AUTH BLOCKED: set OWNER_EMAIL and OWNER_PASSWORD (or E2E_OWNER_*) in .env.e2e.local',
    )
  }
  return env
}
