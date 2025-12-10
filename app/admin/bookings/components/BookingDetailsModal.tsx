'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  booking: Booking
  onClose: () => void
  onUpdate: (booking: Booking) => void
}

export default function BookingDetailsModal({ booking, onClose, onUpdate }: Props) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === booking.status) return

    setIsUpdating(true)
    setError('')

    try {
      const supabase = createClient('admin')
      const { data, error: updateError } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id)
        .select(`
          *,
          profiles(id, full_name, email, phone, company),
          spaces(id, name, type, location)
        `)
        .single()

      if (updateError) throw updateError

      onUpdate(data)
      
      // Show success message
      alert(`Booking status updated to ${newStatus}`)
    } catch (err: any) {
      console.error('Error updating booking:', err)
      setError(err.message || 'Failed to update booking status')
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const calculateDuration = () => {
    const start = new Date(booking.start_time)
    const end = new Date(booking.end_time)
    const diffMs = end.getTime() - start.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24)
      return `${days} day${days > 1 ? 's' : ''}`
    }
    return `${diffHours}h ${diffMinutes}m`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Booking Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Status Badge */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Status</label>
            <span className={`inline-flex px-4 py-2 text-sm font-medium rounded-lg border ${getStatusColor(booking.status)}`}>
              {booking.status.toUpperCase()}
            </span>
          </div>

          {/* User Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">User Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Full Name</p>
                <p className="text-sm font-medium text-gray-900">{booking.profiles.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">{booking.profiles.email}</p>
              </div>
              {booking.profiles.phone && (
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{booking.profiles.phone}</p>
                </div>
              )}
              {booking.profiles.company && (
                <div>
                  <p className="text-xs text-gray-500">Company</p>
                  <p className="text-sm font-medium text-gray-900">{booking.profiles.company}</p>
                </div>
              )}
            </div>
          </div>

          {/* Space Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Space Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Space Name</p>
                <p className="text-sm font-medium text-gray-900">{booking.spaces.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Space Type</p>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {booking.spaces.type.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Location</p>
                <p className="text-sm font-medium text-gray-900">{booking.spaces.location}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Attendees</p>
                <p className="text-sm font-medium text-gray-900">{booking.attendees_count} person(s)</p>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Booking Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Start Date & Time</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(booking.start_time).toLocaleString('en-MY', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">End Date & Time</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(booking.end_time).toLocaleString('en-MY', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-medium text-gray-900">{calculateDuration()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration Type</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{booking.duration_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-lg font-bold text-gray-900">
                  RM {Number(booking.total_amount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Created At</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(booking.created_at).toLocaleString('en-MY', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Notes and Special Requirements */}
          {(booking.notes || booking.special_requirements) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Information</h3>
              {booking.notes && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-900">{booking.notes}</p>
                </div>
              )}
              {booking.special_requirements && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Special Requirements</p>
                  <p className="text-sm text-gray-900">{booking.special_requirements}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Update Status</h3>
            <div className="flex flex-wrap gap-2">
              {booking.status !== 'confirmed' && (
                <button
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Booking
                </button>
              )}
              {booking.status !== 'pending' && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('pending')}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Mark as Pending
                </button>
              )}
              {booking.status !== 'completed' && (
                <button
                  onClick={() => handleStatusChange('completed')}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Mark as Completed
                </button>
              )}
              {booking.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

