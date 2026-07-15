import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function assertEnv(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(
      `Missing ${name}. Set it in .env.local (never commit secrets).`,
    )
  }
  return value.trim()
}

const supabaseUrl = assertEnv(url, 'VITE_SUPABASE_URL')
const supabaseKey = assertEnv(publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY')

/** Single browser Supabase client — publishable key only, never service role. */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  },
)

export type TypedSupabaseClient = typeof supabase
