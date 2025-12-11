'use client'

import Link from 'next/link'
import { useAuth } from './AuthProvider'

export default function NavBar() {
  const { user, loading, signOut } = useAuth()

  return (
    <nav className="fixed top-0 w-full bg-white border-b border-gray-200 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Link href="/" className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-blue-600">∞8</div>
              <span className="text-xl font-semibold text-gray-900">Infinity8</span>
            </Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <a href="#spaces" className="text-gray-600 hover:text-blue-600 transition">Spaces</a>
            <a href="#amenities" className="text-gray-600 hover:text-blue-600 transition">Amenities</a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition">Pricing</a>
            <a href="#contact" className="text-gray-600 hover:text-blue-600 transition">Contact</a>
          </div>
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="w-20 h-10 bg-gray-100 animate-pulse rounded-lg" />
            ) : user ? (
              <>
                <Link 
                  href="/dashboard" 
                  className="text-gray-600 hover:text-blue-600 transition font-medium"
                >
                  Dashboard
                </Link>
                <button
                  onClick={signOut}
                  className="text-gray-600 hover:text-gray-900 transition"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/auth/login" 
                  className="text-gray-600 hover:text-blue-600 transition font-medium"
                >
                  Sign in
                </Link>
                <Link 
                  href="/auth/signup" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition font-medium"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
