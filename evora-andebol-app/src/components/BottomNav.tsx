import { NavLink } from 'react-router-dom'
import { Home, Receipt, CalendarDays, ClipboardCheck, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { canManageAttendance } from '../lib/permissions'

export default function BottomNav() {
  const { user } = useAuth()
  if (!user) return null

  const items = [
    { to: '/', label: 'Início', Icon: Home, end: true },
    { to: '/fines', label: 'Multas', Icon: Receipt },
    { to: '/attendance', label: 'Presenças', Icon: CalendarDays },
    ...(canManageAttendance(user.role)
      ? [{ to: '/markings', label: 'Marcar', Icon: ClipboardCheck }]
      : []),
    { to: '/profile', label: 'Perfil', Icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div className="w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-auto">
        <div className="flex rounded-pill bg-surface/90 backdrop-blur-xl border border-border shadow-[0_12px_40px_rgba(0,0,0,0.55)] px-2 py-2">
          {items.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex-1 flex flex-col items-center justify-center py-1.5 gap-1 rounded-pill icon-bounce"
            >
              {({ isActive }) => (
                <span
                  className={`pressable flex flex-col items-center gap-1 px-3 py-1.5 rounded-pill ${
                    isActive
                      ? 'bg-primary text-bg shadow-[0_6px_20px_rgba(245,184,0,0.35)]'
                      : 'text-text-dim hover:bg-surface-2'
                  }`}
                >
                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    className={isActive ? 'text-bg' : 'text-text-dim'}
                  />
                  <span
                    className={`text-[10px] font-bold tracking-wide leading-none ${
                      isActive ? 'text-bg' : 'text-text-dim'
                    }`}
                  >
                    {label}
                  </span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}