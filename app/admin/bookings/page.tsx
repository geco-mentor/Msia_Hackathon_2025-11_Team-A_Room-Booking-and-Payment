import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '../dashboard/components/AdminSidebar'
import AdminHeader from '../dashboard/components/AdminHeader'
import BookingsManagement from './components/BookingsManagement'

export default async function AdminBookingsPage() {
  const supabase = await createClient('admin')
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    redirect('/admin/login')
  }

  // Fetch all bookings with user and space details
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      profiles(id, full_name, email, phone, company),
      spaces(id, name, type, location)
    `)
    .order('start_time', { ascending: false })

  // Get booking stats
  const now = new Date().toISOString()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const [
    { count: totalBookings },
    { count: pendingBookings },
    { count: confirmedBookings },
    { count: todayBookings },
    { data: upcomingBookings }
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .gte('start_time', startOfToday.toISOString())
      .lte('start_time', endOfToday.toISOString())
      .neq('status', 'cancelled'),
    supabase.from('bookings').select('*, profiles(full_name), spaces(name)')
      .gte('start_time', now)
      .neq('status', 'cancelled')
      .order('start_time')
      .limit(10)
  ])

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar profile={profile} />
      
      <div className="lg:pl-64">
        <AdminHeader profile={profile} />
        
        <main className="py-8 px-4 sm:px-6 lg:px-8">
          <BookingsManagement 
            initialBookings={bookings || []}
            stats={{
              total: totalBookings || 0,
              pending: pendingBookings || 0,
              confirmed: confirmedBookings || 0,
              today: todayBookings || 0
            }}
            upcomingBookings={upcomingBookings || []}
          />
        </main>
      </div>
    </div>
  )
}

