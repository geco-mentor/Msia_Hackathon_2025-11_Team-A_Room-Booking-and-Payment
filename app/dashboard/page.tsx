import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ChatBot from '@/app/components/ChatBot'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch user's bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, spaces(*)')
    .eq('user_id', user.id)
    .order('start_time', { ascending: false })
    .limit(5)

  // Fetch active membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dashboard Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Link href="/" className="flex items-center space-x-2">
                <div className="text-2xl font-bold text-blue-600">∞8</div>
                <span className="text-xl font-semibold text-gray-900">Infinity8</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                {profile?.full_name || user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Member'}!
          </h1>
          <p className="mt-1 text-gray-600">
            Manage your bookings, membership, and workspace preferences.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Current Membership
            </h3>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {membership ? membership.plan_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'No active plan'}
            </p>
            {membership && (
              <p className="mt-1 text-sm text-gray-500">
                Valid until {new Date(membership.end_date).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Upcoming Bookings
            </h3>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {bookings?.filter(b => new Date(b.start_time) > new Date() && b.status !== 'cancelled').length || 0}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Active reservations
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Meeting Room Hours
            </h3>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {membership ? `${membership.meeting_room_hours_used}/${membership.meeting_room_hours_included}` : '0/0'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Hours used this month
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            href="/bookings/new"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-4 text-center font-medium transition"
          >
            Book a Space
          </Link>
          <Link
            href="/bookings"
            className="bg-white hover:bg-gray-50 text-gray-900 rounded-lg p-4 text-center font-medium border border-gray-200 transition"
          >
            My Bookings
          </Link>
          <Link
            href="/membership"
            className="bg-white hover:bg-gray-50 text-gray-900 rounded-lg p-4 text-center font-medium border border-gray-200 transition"
          >
            Manage Membership
          </Link>
          <Link
            href="/profile"
            className="bg-white hover:bg-gray-50 text-gray-900 rounded-lg p-4 text-center font-medium border border-gray-200 transition"
          >
            Edit Profile
          </Link>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {bookings && bookings.length > 0 ? (
              bookings.map((booking: any) => (
                <div key={booking.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{booking.spaces?.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(booking.start_time).toLocaleDateString()} at{' '}
                      {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>No bookings yet. Book your first space today!</p>
                <Link
                  href="/bookings/new"
                  className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Browse available spaces →
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* AI Chatbot */}
      <ChatBot />
    </div>
  )
}
