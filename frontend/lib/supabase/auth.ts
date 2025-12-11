export const SUPABASE_COOKIE_NAMES = {
  user: 'sb-user-auth',
  admin: 'sb-admin-auth',
} as const

export type SupabaseAuthScope = keyof typeof SUPABASE_COOKIE_NAMES

export const getSupabaseCookieName = (scope: SupabaseAuthScope = 'user') =>
  SUPABASE_COOKIE_NAMES[scope]

export const getScopeFromPath = (pathname: string): SupabaseAuthScope =>
  pathname.startsWith('/admin') || pathname.startsWith('/auth/admin') ? 'admin' : 'user'
