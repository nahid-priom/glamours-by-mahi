/**
 * Test personas — labels only. Permissions must be verified at runtime.
 * Credentials come from env; never hardcode passwords.
 */

export const PERSONAS = [
  'OWNER',
  'ADMIN',
  'ACCOUNTANT',
  'BRANCH_MANAGER',
  'CASHIER',
  'MODERATOR',
  'SALES_STAFF',
  'HR_ONLY',
  'WEBSITE_EDITOR',
  'CUSTOMER',
  'GUEST',
  'NO_PERMISSION',
  'INACTIVE_USER',
  'NO_PROFILE',
] as const

export type Persona = (typeof PERSONAS)[number]

export type PersonaCredentials = {
  persona: Persona
  email: string
  password: string
  configured: boolean
}

function pair(
  persona: Persona,
  emailKeys: string[],
  passwordKeys: string[],
): PersonaCredentials {
  let email = ''
  let password = ''
  for (const k of emailKeys) {
    if (process.env[k]) {
      email = process.env[k]!
      break
    }
  }
  for (const k of passwordKeys) {
    if (process.env[k]) {
      password = process.env[k]!
      break
    }
  }
  return { persona, email, password, configured: Boolean(email && password) }
}

export function resolvePersonaCredentials(): PersonaCredentials[] {
  return [
    pair(
      'OWNER',
      ['OWNER_EMAIL', 'E2E_OWNER_EMAIL', 'E2E_ADMIN_EMAIL', 'E2E_EMAIL'],
      ['OWNER_PASSWORD', 'E2E_OWNER_PASSWORD', 'E2E_ADMIN_PASSWORD', 'E2E_PASSWORD'],
    ),
    pair('ADMIN', ['ADMIN_EMAIL'], ['ADMIN_PASSWORD']),
    pair('CASHIER', ['CASHIER_EMAIL'], ['CASHIER_PASSWORD']),
    pair('BRANCH_MANAGER', ['BRANCH_MANAGER_EMAIL'], ['BRANCH_MANAGER_PASSWORD']),
    pair('ACCOUNTANT', ['ACCOUNTANT_EMAIL'], ['ACCOUNTANT_PASSWORD']),
    pair('MODERATOR', ['MODERATOR_EMAIL'], ['MODERATOR_PASSWORD']),
    pair('SALES_STAFF', ['SALES_STAFF_EMAIL'], ['SALES_STAFF_PASSWORD']),
    pair('HR_ONLY', ['HR_ONLY_EMAIL'], ['HR_ONLY_PASSWORD']),
    pair('WEBSITE_EDITOR', ['WEBSITE_EDITOR_EMAIL'], ['WEBSITE_EDITOR_PASSWORD']),
    pair('CUSTOMER', ['CUSTOMER_EMAIL'], ['CUSTOMER_PASSWORD']),
  ]
}

export function uniqueFixtureTag(runId: string, label: string): string {
  return `qa:${runId}:${label}`
}
