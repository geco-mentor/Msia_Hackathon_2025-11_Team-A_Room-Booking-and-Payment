'use client'

import { useState, Suspense, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for error in URL params (from expired confirmation link)
  useEffect(() => {
    const errorCode = searchParams.get('error_code')
    const errorDesc = searchParams.get('error_description')
    
    if (errorCode === 'otp_expired') {
      setError('Your confirmation link has expired. Please enter your email and click "Resend Confirmation" below.')
      setShowResend(true)
    } else if (errorDesc) {
      setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
      setShowResend(true)
    }
  }, [searchParams])

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }
    
    setResendLoading(true)
    setError(null)
    setInfo(null)
    
    const supabase = createClient()
    
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/login`,
      }
    })
    
    if (resendError) {
      setError(resendError.message)
    } else {
      setInfo('Confirmation email sent! Please check your inbox and click the link within 1 hour.')
      setShowResend(false)
    }
    
    setResendLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    const supabase = createClient()
    
    // First, sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      // Check if email not confirmed
      if (authError.message.includes('Email not confirmed')) {
        setError('Email not confirmed. Please check your inbox or click "Resend Confirmation" below.')
        setShowResend(true)
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      // Profile doesn't exist - try to create it with admin role
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email,
          full_name: authData.user.user_metadata?.full_name || '',
          role: authData.user.user_metadata?.role === 'admin' ? 'admin' : 'user',
          is_active: true
        })
      
      if (insertError) {
        console.error('Profile creation error:', insertError)
        await supabase.auth.signOut()
        setError('Unable to verify admin access. Please try again or contact support.')
        setLoading(false)
        return
      }
      
      // Check role from metadata
      if (authData.user.user_metadata?.role !== 'admin') {
        await supabase.auth.signOut()
        setError('Access denied. Admin privileges required.')
        setLoading(false)
        return
      }
      
      router.push('/admin/dashboard')
      router.refresh()
      return
    }

    if (!profile.is_active) {
      await supabase.auth.signOut()
      setError('Your account has been deactivated')
      setLoading(false)
      return
    }

    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      await supabase.auth.signOut()
      setError('Access denied. Admin privileges required.')
      setLoading(false)
      return
    }

    router.push('/admin/dashboard')
    router.refresh()
  }

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {info && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {info}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Admin Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="admin@infinity8.my"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Signing in...' : 'Sign in to Admin'}
        </button>
      </form>
      
      {showResend && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-3 text-center">
            Didn&apos;t receive or link expired?
          </p>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={resendLoading || !email}
            className="w-full flex justify-center py-2 px-4 border border-blue-600 rounded-lg text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {resendLoading ? 'Sending...' : 'Resend Confirmation Email'}
          </button>
        </div>
      )}
    </>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2">
            <div className="text-3xl font-bold text-blue-600">∞8</div>
            <span className="text-2xl font-semibold text-gray-900">Infinity8</span>
          </Link>
          <div className="mt-4 inline-block px-3 py-1 bg-gray-200 rounded-full">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Admin Portal</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Admin Sign In
          </h2>
          <p className="mt-2 text-gray-600">
            Access the management dashboard
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg border border-gray-200">
          <Suspense fallback={<div className="animate-pulse h-64 bg-gray-100 rounded-lg" />}>
            <AdminLoginForm />
          </Suspense>
        </div>

        <p className="text-center text-sm text-gray-600">
          Need an admin account?{' '}
          <Link href="/admin/signup" className="font-medium text-blue-600 hover:text-blue-500 transition">
            Register here
          </Link>
        </p>

        <p className="text-center text-sm text-gray-600">
          <Link href="/" className="font-medium text-gray-500 hover:text-gray-700 transition">
            ← Back to main site
          </Link>
        </p>
      </div>
    </div>
  )
}
