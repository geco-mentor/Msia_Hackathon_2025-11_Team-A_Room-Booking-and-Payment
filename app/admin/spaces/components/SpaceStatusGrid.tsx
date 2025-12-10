'use client'

import { useState } from 'react'

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
}

interface Props {
  spaces: Space[]
  bookings: Booking[]
}

export default function SpaceStatusGrid({ spaces, bookings }: Props) {
  const [filterType, setFilterType] = useState<string>('all')

  const getSpaceStatus = (spaceId: string) => {
    const now = new Date()
    
    // Check if currently occupied
    const currentBooking = bookings.find(b => {
      const start = new Date(b.start_time)
      const end = new Date(b.end_time)
      return b.space_id === spaceId && 
             start <= now && 
             end >= now && 
             b.status === 'confirmed'
    })

    if (currentBooking) {
      return {
        status: 'occupied',
        label: 'Occupied',
        color: 'bg-white border-green-700 text-gray-800',
        dotColor: 'bg-red-500',
        booking: currentBooking
      }
    }

    // Check for upcoming bookings (next 2 hours)
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const upcomingBooking = bookings.find(b => {
      const start = new Date(b.start_time)
      return b.space_id === spaceId && 
             start > now && 
             start <= twoHoursFromNow && 
             (b.status === 'confirmed' || b.status === 'pending')
    })

    if (upcomingBooking) {
      return {
        status: 'upcoming',
        label: 'Upcoming',
        color: 'bg-white border-green-700 text-gray-800',
        dotColor: 'bg-yellow-500',
        booking: upcomingBooking
      }
    }

    return {
      status: 'available',
      label: 'Available',
      color: 'bg-white border-green-700 text-gray-800',
      dotColor: 'bg-green-500'
    }
  }

  const filteredSpaces = filterType === 'all' 
    ? spaces 
    : spaces.filter(s => s.type === filterType)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hot_desk':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case 'private_office':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        )
      case 'meeting_room':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Space Status</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('hot_desk')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              filterType === 'hot_desk'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hot Desks
          </button>
          <button
            onClick={() => setFilterType('private_office')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              filterType === 'private_office'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Offices
          </button>
          <button
            onClick={() => setFilterType('meeting_room')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              filterType === 'meeting_room'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Meeting Rooms
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSpaces.map((space) => {
          const status = getSpaceStatus(space.id)
          
          return (
            <div
              key={space.id}
              className={`border-[4px] rounded-lg p-4 transition hover:shadow-md ${status.color}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getTypeIcon(space.type)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{space.name}</h3>
                    <p className="text-xs text-gray-600 capitalize">{space.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${status.dotColor} animate-pulse`} />
                  <span className="text-xs font-medium">{status.label}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-700">
                  <span>Capacity:</span>
                  <span className="font-medium">{space.capacity} {space.capacity === 1 ? 'person' : 'people'}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700">
                  <span>Location:</span>
                  <span className="font-medium">{space.floor || 'Ground'} Floor</span>
                </div>
                {space.hourly_rate && (
                  <div className="flex items-center justify-between text-gray-700">
                    <span>Rate:</span>
                    <span className="font-medium">RM {space.hourly_rate}/hr</span>
                  </div>
                )}
              </div>

              {status.booking && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    {status.status === 'occupied' ? 'Current Booking:' : 'Next Booking:'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {status.booking.profiles?.full_name || 'Unknown User'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(status.booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(status.booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {!space.is_active && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs font-medium text-red-600">Inactive</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredSpaces.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p>No spaces found</p>
        </div>
      )}
    </div>
  )
}

