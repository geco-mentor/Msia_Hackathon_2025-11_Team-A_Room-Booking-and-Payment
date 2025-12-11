import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseCookieName, type SupabaseAuthScope } from './auth'

const clientCache: Partial<Record<SupabaseAuthScope, SupabaseClient>> = {}

export function createClient(scope: SupabaseAuthScope = 'user') {
  if (!clientCache[scope]) {
    clientCache[scope] = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          name: getSupabaseCookieName(scope),
        },
        // Disable the internal singleton so we can cache per scope instead.
        isSingleton: false,
      }
    )
  }

  return clientCache[scope]!
}
