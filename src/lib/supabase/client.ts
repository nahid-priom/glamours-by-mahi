import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPublicEnvConfig } from '@/lib/env/config'

const { supabaseUrl, supabasePublishableKey: supabaseKey } = getPublicEnvConfig()

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
