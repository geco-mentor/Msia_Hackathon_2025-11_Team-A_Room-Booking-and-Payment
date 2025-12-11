import AdminChatBot from '../dashboard/components/AdminChatBot'

export default function SpacesLayout({
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
