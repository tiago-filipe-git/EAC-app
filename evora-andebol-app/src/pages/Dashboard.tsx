import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Receipt,
  CalendarDays,
  Sparkles,
  ChevronRight,
  TrendingUp,
  ClipboardCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { canManageFines, canManageAttendance, roleLabel } from '../lib/permissions'
import { getAttendanceUserStats, getFinesMine, getFines } from '../lib/api'
import Skeleton from '../components/Skeleton'

export default function Dashboard() {
  const { user } = useAuth()
  const [fines, setFines] = useState<any[]>([])
  const [allFines, setAllFines] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const isManager = user ? canManageFines(user.role) : false

  const fetchAll = () => {
    if (!user) return
    const year = new Date().getFullYear()

    const tasks: Promise<any>[] = [
      getAttendanceUserStats(user.id, year).catch(() => null),
      getFinesMine().catch(() => []),
    ]

    if (isManager) {
      tasks.push(getFines().catch(() => []))
    }

    Promise.all(tasks)
      .then(([a, mine, all]) => {
        setAttendance(a)
        setFines(mine)
        setAllFines(all || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isManager])

  useEffect(() => {
    const handler = () => fetchAll()
    window.addEventListener('data-changed', handler)
    return () => window.removeEventListener('data-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isManager])

  if (!user) return null

  const showMarkings = canManageAttendance(user.role)

  const myPending = fines.filter((f) => f.status === 'PENDENTE')
  const myPendingAmount = myPending.reduce((s, f) => s + f.amount, 0)

  const allPending = allFines.filter((f) => f.status === 'PENDENTE')
  const allPendingAmount = allPending.reduce((s, f) => s + f.amount, 0)

  const firstName = user.name.split(' ')[0]
  const attendancePct = Math.round(attendance?.attendance_rate ?? 0)

  if (loading) {
    return (
      <div className="page space-y-5 pb-32">
        <Skeleton.Hero />
        <Skeleton.Hero />
        <div className="grid grid-cols-3 gap-3">
          <div className="skeleton-block h-20" />
          <div className="skeleton-block h-20" />
          <div className="skeleton-block h-20" />
        </div>
        <div className="space-y-2">
          <div className="skeleton-block h-3 w-20" />
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </div>
      </div>
    )
  }

  return (
    <div className="page space-y-5 pb-32">
      <section className="hero-glow p-5 animate-rise">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center">
                <span className="text-xs font-extrabold text-primary">
                  {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-text-muted font-medium leading-tight">Olá,</p>
              <p className="text-sm font-extrabold text-text leading-tight">{firstName}</p>
            </div>
          </div>
          <span className="chip bg-surface-2 border border-border text-text-muted flex items-center gap-1">
            <TrendingUp size={11} strokeWidth={2.5} />
            {roleLabel(user.role)}
          </span>
        </div>
      </section>

      <section className="hero-glow p-5 animate-rise stagger-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          As minhas multas
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-3xl font-extrabold tracking-tight text-primary leading-none tabular-nums">
            €{myPendingAmount.toFixed(2)}
          </p>
          <span className="chip bg-surface-2 border border-border text-text-muted">
            {myPending.length} pendente{myPending.length === 1 ? '' : 's'}
          </span>
        </div>
        <Link
          to="/fines?view=minhas"
          className="mt-4 btn-primary pressable py-3! text-sm flex items-center justify-center gap-1.5 w-full"
        >
          <Receipt size={16} strokeWidth={2.4} />
          Ver as minhas
        </Link>
      </section>

      {isManager && (
        <section className="card p-5 animate-rise stagger-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Todas as multas
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-3xl font-extrabold tracking-tight text-text leading-none tabular-nums">
              €{allPendingAmount.toFixed(2)}
            </p>
            <span className="chip bg-surface-2 border border-border text-text-muted">
              {allFines.length} no total
            </span>
          </div>
          <Link
            to="/fines?view=todos"
            className="mt-4 btn-ghost pressable py-3! text-sm flex items-center justify-center gap-1.5 w-full"
          >
            <Users size={16} strokeWidth={2.2} />
            Ver todas
          </Link>
        </section>
      )}

      <section className="grid grid-cols-3 gap-3 animate-rise stagger-3">
        <StatBox label="Multas" value={fines.length} />
        <StatBox label="Pendentes" value={myPending.length} accent="danger" />
        <StatBox label="Assiduidade" value={`${attendancePct}%`} accent="success" />
      </section>

      <section className="space-y-2 animate-rise stagger-4">
        <p className="section-title">Ações</p>
        <ActionRow
          to="/attendance"
          icon={CalendarDays}
          title="Presenças"
          subtitle="Calendário da equipa"
        />
        {showMarkings && (
          <ActionRow
            to="/markings"
            icon={ClipboardCheck}
            title="Marcar treino"
            subtitle="Registar presenças"
          />
        )}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-assistant'))}
          className="card lift pressable w-full flex items-center gap-3 p-3.5 text-left"
        >
          <div className="icon-tile">
            <Sparkles size={20} strokeWidth={1.9} className="text-primary" />
          </div>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-text">Assistente IA</span>
            <span className="block text-[11px] text-text-muted truncate">
              Pergunta ou pede para registar
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.9} className="text-text-dim" />
        </button>
      </section>
    </div>
  )
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: 'danger' | 'success'
}) {
  const color =
    accent === 'danger'
      ? 'text-danger'
      : accent === 'success'
        ? 'text-success'
        : 'text-text'
  return (
    <div className="card lift p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
        {label}
      </p>
      <p className={`text-2xl font-extrabold tracking-tight mt-1 tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  )
}

function ActionRow({
  to,
  icon: Icon,
  title,
  subtitle,
  badge,
}: {
  to: string
  icon: any
  title: string
  subtitle?: string
  badge?: string
}) {
  return (
    <Link
      to={to}
      className="card lift pressable flex items-center gap-3 p-3.5 text-left"
    >
      <div className="icon-tile">
        <Icon size={20} strokeWidth={1.9} className="text-primary" />
      </div>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-text">{title}</span>
        {subtitle && (
          <span className="block text-[11px] text-text-muted truncate">{subtitle}</span>
        )}
      </span>
      {badge && <span className="chip bg-danger-soft text-danger">{badge}</span>}
      <ChevronRight size={18} strokeWidth={1.9} className="text-text-dim" />
    </Link>
  )
}