import AdminChatBot from '../dashboard/components/AdminChatBot'

export default function KnowledgeBaseLayout({
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
