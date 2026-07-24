import { createClient } from '@supabase/supabase-js'
import { ANON_KEY, SERVICE_KEY, SUPABASE_URL } from './env.mjs'

export const client = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const admin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null

export async function signIn() {
  const { SEED_EMAIL, SEED_PASSWORD } = await import('./env.mjs')
  const { data, error } = await client.auth.signInWithPassword({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
  })
  if (error) throw new Error(`Sign-in failed: ${error.message}`)
  return data.user
}

/** Prefer service-role for reads that must bypass RLS during verification. */
export function db() {
  return admin ?? client
}
