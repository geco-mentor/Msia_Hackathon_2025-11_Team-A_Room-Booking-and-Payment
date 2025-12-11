'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import BookingDetailsModal from './BookingDetailsModal'

interface Booking {
  id: string
  user_id: string
  space_id: string
  start_time: string
  end_time: string
  duration_type: string
  status: string
  total_amount: number
  attendees_count: number
  notes: string | null
  special_requirements: string | null
  created_at: string
  profiles: {
    id: string
    full_name: string
    email: string
    phone: string | null
    company: string | null
  }
  spaces: {
    id: string
    name: string
    type: string
    location: string
  }
}

interface Props {
  initialBookings: Booking[]
  stats: {
    total: number
    pending: number
    confirmed: number
    today: number
  }
  upcomingBookings: any[]
}

export default function BookingsManagement({ initialBookings, stats, upcomingBookings }: Props) {
  const searchParams = useSearchParams()
  const [bookings, setBookings] = useState(initialBookings)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date')
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null)

  // Handle URL parameter to auto-open booking details
  useEffect(() => {
    const bookingId = searchParams.get('id')
    if (bookingId) {
      const booking = bookings.find(b => b.id === bookingId)
      if (booking) {
        setSelectedBooking(booking)
        setShowModal(true)
        setHighlightedBookingId(bookingId)
        // Scroll to the booking row after a short delay
        setTimeout(() => {
          const row = document.getElementById(`booking-${bookingId}`)
          if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      }
    }
  }, [searchParams, bookings])

  // Filter and sort bookings
  const filteredBookings = bookings
    .filter(booking => {
      const matchesStatus = filterStatus === 'all' || booking.status === filterStatus
      const matchesSearch = searchQuery === '' || 
        booking.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.profiles.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.spaces.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      } else if (sortBy === 'amount') {
        return b.total_amount - a.total_amount
      } else {
        return a.status.localeCompare(b.status)
      }
    })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDurationTypeLabel = (type: string) => {
    switch (type) {
      case 'hourly': return 'Hourly'
      case 'daily': return 'Daily'
      case 'monthly': return 'Monthly'
      default: return type
    }
  }

  const getSpaceTypeLabel = (type: string) => {
    switch (type) {
      case 'hot_desk': return 'Hot Desk'
      case 'private_office': return 'Private Office'
      case 'meeting_room': return 'Meeting Room'
      default: return type
    }
  }

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking)
    setShowModal(true)
  }

  const handleBookingUpdate = (updatedBooking: Booking) => {
    setBookings(prev => 
      prev.map(b => b.id === updatedBooking.id ? updatedBooking : b)
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
        <p className="text-gray-600">View and manage all bookings in the system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Bookings</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Confirmed</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{stats.confirmed}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Today</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{stats.today}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by user, email, or space..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'status')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            All Bookings ({filteredBookings.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Space</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    id={`booking-${booking.id}`}
                    className={`hover:bg-gray-50 transition-colors ${
                      highlightedBookingId === booking.id
                        ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{booking.profiles.full_name}</p>
                        <p className="text-xs text-gray-500">{booking.profiles.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm text-gray-900">{booking.spaces.name}</p>
                        <p className="text-xs text-gray-500">{getSpaceTypeLabel(booking.spaces.type)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm text-gray-900">
                          {new Date(booking.start_time).toLocaleDateString('en-MY', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(booking.start_time).toLocaleTimeString('en-MY', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })} - {new Date(booking.end_time).toLocaleTimeString('en-MY', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {getDurationTypeLabel(booking.duration_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      RM {Number(booking.total_amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewDetails(booking)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Details Modal */}
      {showModal && selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => {
            setShowModal(false)
            setSelectedBooking(null)
          }}
          onUpdate={handleBookingUpdate}
        />
      )}
    </div>
  )
}






