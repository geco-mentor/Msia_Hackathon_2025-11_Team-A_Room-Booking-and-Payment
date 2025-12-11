import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '../dashboard/components/AdminSidebar'
import AdminHeader from '../dashboard/components/AdminHeader'
import KnowledgeBaseUpload from './components/KnowledgeBaseUpload'
import UnansweredQueries from './components/UnansweredQueries'

export default async function KnowledgeBasePage() {
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

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar profile={profile} />

      <div className="lg:pl-64">
        <AdminHeader profile={profile} />

        <main className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Base Management</h1>
            <p className="text-gray-600">Upload policy documents and knowledge files for the Infinity8 AI Assistant</p>
          </div>

          <div className="space-y-8">
            <KnowledgeBaseUpload />
            <UnansweredQueries adminId={user.id} />
          </div>
        </main>
      </div>
    </div>
  )
}






