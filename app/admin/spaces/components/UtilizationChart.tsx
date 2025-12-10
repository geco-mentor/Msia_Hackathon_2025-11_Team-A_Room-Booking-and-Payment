'use client'

import { useMemo } from 'react'

interface Booking {
  start_time: string
  end_time: string
  spaces?: {
    type: string
  }
}

interface Props {
  monthBookings: Booking[]
  totalSpaces: number
}

export default function UtilizationChart({ monthBookings, totalSpaces }: Props) {
  // Calculate utilization by day for the past 7 days
  const weeklyData = useMemo(() => {
    const data = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      
      // Count bookings for this day
      const dayBookings = monthBookings.filter(b => {
        const bookingDate = new Date(b.start_time)
        return bookingDate >= date && bookingDate < nextDay
      })
      
      const utilizationRate = totalSpaces > 0 
        ? Math.round((dayBookings.length / totalSpaces) * 100) 
        : 0
      
      data.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        shortDate: date.toLocaleDateString('en-US', { weekday: 'short' }),
        bookings: dayBookings.length,
        utilization: Math.min(utilizationRate, 100) // Cap at 100%
      })
    }
    
    return data
  }, [monthBookings, totalSpaces])

  const maxBookings = Math.max(...weeklyData.map(d => d.bookings), 1)

  // Calculate average utilization
  const avgUtilization = weeklyData.length > 0
    ? Math.round(weeklyData.reduce((sum, d) => sum + d.utilization, 0) / weeklyData.length)
    : 0

  // Calculate trend (comparing first half vs second half of week)
  const firstHalf = weeklyData.slice(0, 3).reduce((sum, d) => sum + d.utilization, 0) / 3
  const secondHalf = weeklyData.slice(4).reduce((sum, d) => sum + d.utilization, 0) / 3
  const trend = secondHalf - firstHalf
  const trendDirection = trend > 5 ? 'up' : trend < -5 ? 'down' : 'stable'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Weekly Utilization</h2>
          <p className="text-sm text-gray-600">Past 7 days</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Average</p>
          <p className="text-2xl font-bold text-gray-900">{avgUtilization}%</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="mb-6">
        <div className="flex items-end justify-between gap-2 h-48">
          {weeklyData.map((day, index) => {
            const height = maxBookings > 0 ? (day.bookings / maxBookings) * 100 : 0
            const colorClass = 
              day.utilization >= 80 ? 'bg-red-500' :
              day.utilization >= 50 ? 'bg-yellow-500' :
              'bg-green-500'
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full relative group">
                  <div 
                    className={`${colorClass} rounded-t-lg transition-all duration-300 hover:opacity-80 cursor-pointer`}
                    style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                        <p className="font-semibold">{day.date}</p>
                        <p>{day.bookings} bookings</p>
                        <p>{day.utilization}% utilization</p>
                      </div>
                      <div className="w-2 h-2 bg-gray-900 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 font-medium">{day.shortDate}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend and Stats */}
      <div className="pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-xs text-gray-600">Low (&lt;50%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span className="text-xs text-gray-600">Medium (50-79%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-xs text-gray-600">High (≥80%)</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Trend</span>
          <div className="flex items-center gap-2">
            {trendDirection === 'up' && (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="font-medium text-green-600">Increasing</span>
              </>
            )}
            {trendDirection === 'down' && (
              <>
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                <span className="font-medium text-red-600">Decreasing</span>
              </>
            )}
            {trendDirection === 'stable' && (
              <>
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                </svg>
                <span className="font-medium text-gray-600">Stable</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

