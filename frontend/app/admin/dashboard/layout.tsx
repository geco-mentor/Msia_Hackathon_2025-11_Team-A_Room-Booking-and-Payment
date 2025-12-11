import AdminChatBot from './components/AdminChatBot'

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <AdminChatBot />
    </>
  )
}
