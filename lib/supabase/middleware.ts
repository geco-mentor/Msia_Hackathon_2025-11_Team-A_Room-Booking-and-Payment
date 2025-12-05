import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // User protected routes - redirect to login if not authenticated
  const userProtectedPaths = ['/dashboard', '/bookings', '/profile', '/settings', '/membership']
  const isUserProtectedPath = userProtectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isUserProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Admin protected routes - redirect to admin login if not authenticated or not admin
  const adminProtectedPaths = ['/admin/dashboard', '/admin/bookings', '/admin/users', '/admin/spaces', '/admin/memberships', '/admin/payments', '/admin/reports', '/admin/settings']
  const isAdminProtectedPath = adminProtectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAdminProtectedPath) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.is_active || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
  }

  // Redirect authenticated users away from user auth pages
  const userAuthPaths = ['/auth/login', '/auth/signup']
  const isUserAuthPath = userAuthPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isUserAuthPath && user) {
    // Check if user is admin trying to access user auth
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      url.pathname = '/admin/dashboard'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // Redirect authenticated admins away from admin login
  if (request.nextUrl.pathname === '/admin/login' && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (profile?.is_active && (profile?.role === 'admin' || profile?.role === 'super_admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
