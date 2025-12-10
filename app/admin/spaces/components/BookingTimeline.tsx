'use client'

import { useState, useMemo } from 'react'

interface Booking {
  id: string
  space_id: string
  start_time: string
  end_time: string
  status: string
  profiles?: {
    full_name: string
  }
  spaces?: {
    name: string
    type: string
  }
}

interface Props {
  bookings: Booking[]
}

export default function BookingTimeline({ bookings }: Props) {
  const [viewMode, setViewMode] = useState<'today' | 'upcoming'>('today')

  const filteredBookings = useMemo(() => {
    const now = new Date()
    
    if (viewMode === 'today') {
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(now)
      endOfToday.setHours(23, 59, 59, 999)
      
      return bookings.filter(b => {
        const start = new Date(b.start_time)
        return start >= startOfToday && start <= endOfToday
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    } else {
      // Upcoming (next 7 days, excluding today)
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      
      const weekFromNow = new Date(now)
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      
      return bookings.filter(b => {
        const start = new Date(b.start_time)
        return start >= tomorrow && start <= weekFromNow
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    }
  }, [bookings, viewMode])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const isHappening = (booking: Booking) => {
    const now = new Date()
    const start = new Date(booking.start_time)
    const end = new Date(booking.end_time)
    return start <= now && end >= now
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Booking Timeline</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('today')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              viewMode === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setViewMode('upcoming')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              viewMode === 'upcoming'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Upcoming
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking, index) => {
            const happening = isHappening(booking)
            
            return (
              <div
                key={booking.id}
                className={`relative border-l-4 pl-4 py-3 ${
                  happening 
                    ? 'border-blue-500 bg-blue-50' 
                    : booking.status === 'confirmed'
                    ? 'border-green-500'
                    : booking.status === 'pending'
                    ? 'border-yellow-500'
                    : 'border-gray-300'
                }`}
              >
                {happening && (
                  <div className="absolute -left-2 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {viewMode === 'upcoming' && (
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(booking.start_time)}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                      </span>
                      {happening && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          In Progress
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="font-medium text-gray-900">{booking.spaces?.name || 'Unknown Space'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-gray-700">{booking.profiles?.full_name || 'Unknown User'}</span>
                      </div>
                    </div>

                    {booking.spaces?.type && (
                      <p className="text-xs text-gray-500 mt-1 capitalize">
                        {booking.spaces.type.replace('_', ' ')}
                      </p>
                    )}
                  </div>

                  <div className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="font-medium">No bookings {viewMode === 'today' ? 'today' : 'in the next 7 days'}</p>
            <p className="text-sm mt-1">Bookings will appear here when scheduled</p>
          </div>
        )}
      </div>

      {filteredBookings.length > 10 && (
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all bookings →
          </button>
        </div>
      )}
    </div>
  )
}

