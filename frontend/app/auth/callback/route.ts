import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Check if profile exists, if not create it
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', data.user.id)
        .single()
      
      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const role = data.user.user_metadata?.role || 'user'
        await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || '',
            role: role,
            is_active: true
          })
      } else if (!profileError && profile && data.user.user_metadata?.role === 'admin') {
        // Update existing profile to admin if signed up as admin
        await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', data.user.id)
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      // Determine redirect based on role
      let redirectPath = next
      if (data.user.user_metadata?.role === 'admin' && next === '/dashboard') {
        redirectPath = '/admin/login'
      }
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${redirectPath}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
      } else {
        return NextResponse.redirect(`${origin}${redirectPath}`)
      }
    }
    
    // Handle error - redirect with error info
    if (error) {
      const errorParams = new URLSearchParams({
        error: 'access_denied',
        error_code: error.code || 'unknown',
        error_description: error.message || 'Authentication failed'
      })
      
      // If the next path was admin, redirect there with error
      if (next.includes('admin')) {
        return NextResponse.redirect(`${origin}/admin/login?${errorParams}`)
      }
      return NextResponse.redirect(`${origin}/auth/login?${errorParams}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
