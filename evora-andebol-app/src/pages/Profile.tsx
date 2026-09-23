import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Receipt, Calendar, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../lib/permissions'
import { getMyStats } from '../lib/api'
import AccountSettings from '../components/AccountSettings'

export default function Profile() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (!user) return
    getMyStats()
      .then(setStats)
      .catch(() => null)
  }, [user])

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const attendancePct = 0

  return (
    <div className="page space-y-5 pb-32">
      <section className="flex flex-col items-center text-center py-4">
        {user.photo_url ? (
          <img
            src={user.photo_url}
            alt={user.name}
            className="w-24 h-24 rounded-full object-cover border border-border ring-1 ring-border"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-surface-2 border border-border ring-1 ring-border flex items-center justify-center">
            <span className="text-2xl font-extrabold text-primary">{initials}</span>
          </div>
        )}
        <h2 className="text-xl font-extrabold tracking-tight text-text mt-4">
          {user.name}
        </h2>
        <p className="text-xs text-primary font-semibold uppercase tracking-wider mt-1">
          {roleLabel(user.role)}
        </p>
        {user.position && (
          <p className="text-xs text-text-muted mt-0.5">{user.position}</p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-text-dim mb-2">
            <Receipt size={14} strokeWidth={2.2} />
            <p className="text-[10px] font-semibold uppercase tracking-wider">
              Multas
            </p>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-text">
            {stats?.count ?? 0}
          </p>
          <p className="text-[11px] text-text-muted mt-1">
            {stats?.pending != null ? `${stats.pending.toFixed(2)}€ por pagar` : '—'}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-text-dim mb-2">
            <Calendar size={14} strokeWidth={2.2} />
            <p className="text-[10px] font-semibold uppercase tracking-wider">
              Assiduidade
            </p>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-text">
            {attendancePct}%
          </p>
          <p className="text-[11px] text-text-muted mt-1">esta época</p>
        </div>
      </section>

      <AccountSettings />

      <button
        disabled
        className="w-full py-3.5 bg-surface border border-border text-text-muted font-semibold rounded-button text-sm flex items-center justify-center gap-2 opacity-60"
      >
        Mudar foto de perfil
        <span className="text-[10px] uppercase tracking-wider text-text-dim">
          em breve
        </span>
      </button>

      {user.role === 'admin' && (
        <Link
          to="/admin"
          className="w-full py-3.5 bg-surface border border-border text-text font-semibold rounded-button text-sm flex items-center justify-center gap-2 hover:border-primary/40 transition"
        >
          <UserIcon size={16} strokeWidth={2.2} />
          Gestão de users
        </Link>
      )}

      <button
        onClick={logout}
        className="w-full py-3.5 bg-danger-soft border border-danger/30 text-danger font-bold rounded-button text-sm flex items-center justify-center gap-2 transition hover:bg-danger/20"
      >
        <LogOut size={16} strokeWidth={2.2} />
        Terminar sessão
      </button>
    </div>
  )
}
