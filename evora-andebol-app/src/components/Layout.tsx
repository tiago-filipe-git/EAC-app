import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../lib/permissions'
import BottomNav from './BottomNav'
import FABs from './FABs'
import AppShell from './AppShell'
import NotificationBell from './NotificationBell'
import NotificationDrawer from './NotificationDrawer'

export default function Layout() {
  const { user } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  if (!user) return null

  return (
    <AppShell>
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl border-b border-border">
        <div className="px-5 py-3 flex items-center gap-3">
          <img
            src="/apple-touch-icon.png"
            alt="Évora Andebol Clube"
            className="w-9 h-9 rounded-xl shrink-0 ring-1 ring-border object-cover bg-surface-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] font-extrabold tracking-tight text-text truncate leading-tight">
              Évora Andebol Clube
            </h1>
            <p className="text-[11px] text-text-muted truncate leading-tight">
              {user.name.split(' ')[0]} ·{' '}
              <span className="text-primary font-semibold">
                {roleLabel(user.role)}
              </span>
            </p>
          </div>
          <NotificationBell
            onClick={() => setNotifOpen(true)}
            refreshKey={refreshKey}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-28">
        <Outlet />
      </main>

      <FABs />
      <BottomNav />

      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </AppShell>
  )
}