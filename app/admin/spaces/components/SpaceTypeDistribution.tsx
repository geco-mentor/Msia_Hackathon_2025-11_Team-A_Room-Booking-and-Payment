'use client'

interface Space {
  type: 'hot_desk' | 'private_office' | 'meeting_room'
}

interface Props {
  spaces: Space[]
}

export default function SpaceTypeDistribution({ spaces }: Props) {
  // Count spaces by type
  const typeCounts = spaces.reduce((acc, space) => {
    acc[space.type] = (acc[space.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const total = spaces.length

  const types = [
    { 
      key: 'hot_desk', 
      label: 'Hot Desks', 
      color: 'bg-blue-500',
      lightColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      count: typeCounts.hot_desk || 0 
    },
    { 
      key: 'private_office', 
      label: 'Private Offices', 
      color: 'bg-purple-500',
      lightColor: 'bg-purple-100',
      textColor: 'text-purple-700',
      count: typeCounts.private_office || 0 
    },
    { 
      key: 'meeting_room', 
      label: 'Meeting Rooms', 
      color: 'bg-green-500',
      lightColor: 'bg-green-100',
      textColor: 'text-green-700',
      count: typeCounts.meeting_room || 0 
    },
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Space Distribution</h2>

      <div className="space-y-4">
        {types.map((type) => {
          const percentage = total > 0 ? Math.round((type.count / total) * 100) : 0
          
          return (
            <div key={type.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${type.color}`} />
                  <span className="text-sm font-medium text-gray-700">{type.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{type.count} spaces</span>
                  <span className="text-sm font-semibold text-gray-900">{percentage}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 ${type.color} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Visual pie chart representation */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          {types.map((type) => {
            const percentage = total > 0 ? Math.round((type.count / total) * 100) : 0
            
            return (
              <div key={`card-${type.key}`} className={`${type.lightColor} rounded-lg p-4 text-center`}>
                <p className={`text-2xl font-bold ${type.textColor}`}>{type.count}</p>
                <p className="text-xs text-gray-600 mt-1">{type.label}</p>
                <p className={`text-sm font-semibold ${type.textColor} mt-1`}>{percentage}%</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Total Spaces</span>
          <span className="text-2xl font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  )
}

