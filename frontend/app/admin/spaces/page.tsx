import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '../dashboard/components/AdminSidebar'
import AdminHeader from '../dashboard/components/AdminHeader'
import SpaceAvailabilityDashboard from './components/SpaceAvailabilityDashboard'

export default async function AdminSpacesPage() {
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

  // Fetch all spaces with their details
  const { data: spaces } = await supabase
    .from('spaces')
    .select('*')
    .order('name')

  // Get current bookings (today and future)
  const now = new Date().toISOString()
  const { data: currentBookings } = await supabase
    .from('bookings')
    .select('*, profiles(full_name), spaces(name, type)')
    .gte('end_time', now)
    .neq('status', 'cancelled')
    .order('start_time')

  // Get today's bookings for quick stats
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('*, spaces(*)')
    .gte('start_time', startOfToday.toISOString())
    .lte('start_time', endOfToday.toISOString())
    .neq('status', 'cancelled')

  // Calculate space utilization for the past 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: monthBookings } = await supabase
    .from('bookings')
    .select('*, spaces(type)')
    .gte('start_time', thirtyDaysAgo.toISOString())
    .eq('status', 'confirmed')

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar profile={profile} />
      
      <div className="lg:pl-64">
        <AdminHeader profile={profile} />
        
        <main className="py-8 px-4 sm:px-6 lg:px-8">
          <SpaceAvailabilityDashboard 
            initialSpaces={spaces || []}
            initialBookings={currentBookings || []}
            todayBookings={todayBookings || []}
            monthBookings={monthBookings || []}
          />
        </main>
      </div>
    </div>
  )
}






