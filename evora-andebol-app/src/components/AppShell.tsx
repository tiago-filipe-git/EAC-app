export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex justify-center bg-bg">
      <div className="w-full max-w-md min-h-screen flex flex-col relative">
        {children}
      </div>
    </div>
  )
}