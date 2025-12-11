import AdminChatBot from '../dashboard/components/AdminChatBot'

export default function BookingsLayout({
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
