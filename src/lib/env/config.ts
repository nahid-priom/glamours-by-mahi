export interface PublicEnvConfig {
  supabaseUrl: string
  supabasePublishableKey: string
  appTitle: string
}

export type EnvValidationIssue = {
  name: string
  message: string
}

const REQUIRED_PUBLIC_VARS = [
  { key: 'VITE_SUPABASE_URL', label: 'Supabase project URL' },
  { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', label: 'Supabase publishable key' },
] as const

function readEnv(name: string): string | undefined {
  const value = import.meta.env[name as keyof ImportMetaEnv]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function validatePublicEnv(): EnvValidationIssue[] {
  return REQUIRED_PUBLIC_VARS.flatMap(({ key, label }) => {
    const value = readEnv(key)
    if (value) return []
    return [{ name: key, message: `Missing ${label}. Configure ${key} in your deployment environment.` }]
  })
}

export function getPublicEnvConfig(): PublicEnvConfig {
  const issues = validatePublicEnv()
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(' '))
  }

  return {
    supabaseUrl: readEnv('VITE_SUPABASE_URL')!,
    supabasePublishableKey: readEnv('VITE_SUPABASE_PUBLISHABLE_KEY')!,
    appTitle: readEnv('VITE_APP_TITLE') ?? 'Glamorous Gallery By Mahi',
  }
}

export function getPublicEnvIssues(): EnvValidationIssue[] {
  return validatePublicEnv()
}
