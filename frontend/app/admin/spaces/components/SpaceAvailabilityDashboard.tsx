'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import SpaceStatusGrid from './SpaceStatusGrid'
import UtilizationChart from './UtilizationChart'
import BookingTimeline from './BookingTimeline'
import SpaceTypeDistribution from './SpaceTypeDistribution'

interface Space {
  id: string
  name: string
  type: 'hot_desk' | 'private_office' | 'meeting_room'
  capacity: number
  location: string
  floor: string | null
  is_active: boolean
  hourly_rate: number | null
  daily_rate: number | null
  monthly_rate: number | null
}

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
  initialSpaces: Space[]
  initialBookings: Booking[]
  todayBookings: Booking[]
  monthBookings: Booking[]
}

export default function SpaceAvailabilityDashboard({ 
  initialSpaces, 
  initialBookings,
  todayBookings,
  monthBookings
}: Props) {
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [isConnected, setIsConnected] = useState(false)
  const supabase = createClient('admin')

  // Calculate statistics
  const totalSpaces = spaces.length
  const activeSpaces = spaces.filter(s => s.is_active).length
  
  // Current occupancy (bookings happening right now)
  const now = new Date()
  const currentlyOccupied = bookings.filter(b => {
    const start = new Date(b.start_time)
    const end = new Date(b.end_time)
    return start <= now && end >= now && b.status === 'confirmed'
  }).length

  const occupancyRate = totalSpaces > 0 ? Math.round((currentlyOccupied / totalSpaces) * 100) : 0

  // Today's bookings count
  const todayBookingsCount = todayBookings.length

  // Set up real-time subscriptions
  useEffect(() => {
    // Subscribe to spaces changes
    const spacesChannel = supabase
      .channel('spaces-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spaces'
        },
        async (payload) => {
          console.log('Space change received:', payload)
          
          // Refetch all spaces
          const { data } = await supabase
            .from('spaces')
            .select('*')
            .order('name')
          
          if (data) {
            setSpaces(data)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          console.log('Connected to spaces real-time updates')
        }
      })

    // Subscribe to bookings changes
    const bookingsChannel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('Booking change received:', payload)
          
          // Refetch current bookings
          const now = new Date().toISOString()
          const { data } = await supabase
            .from('bookings')
            .select('*, profiles(full_name), spaces(name, type)')
            .gte('end_time', now)
            .neq('status', 'cancelled')
            .order('start_time')
          
          if (data) {
            setBookings(data)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(spacesChannel)
      supabase.removeChannel(bookingsChannel)
    }
  }, [supabase])

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Space Availability Dashboard</h1>
            <p className="text-gray-600">Real-time monitoring and analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isConnected ? 'Live' : 'Connecting...'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Spaces</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{totalSpaces}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Currently Occupied</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{currentlyOccupied}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Occupancy Rate</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{occupancyRate}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Bookings</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{todayBookingsCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Space Type Distribution */}
        <SpaceTypeDistribution spaces={spaces} />

        {/* Utilization Chart */}
        <UtilizationChart monthBookings={monthBookings} totalSpaces={totalSpaces} />
      </div>

      {/* Space Status Grid */}
      <SpaceStatusGrid spaces={spaces} bookings={bookings} />

      {/* Booking Timeline */}
      <BookingTimeline bookings={bookings} />
    </div>
  )
}






