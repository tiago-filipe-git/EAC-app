import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCheck,
  Sparkles,
  ShieldAlert,
  Timer,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { canManageAttendance } from '../lib/permissions'
import {
  getAttendanceDay,
  markAttendance,
  getAttendanceDayCount,
  deleteAttendanceDay,
} from '../lib/api'

type Status = 'PRESENTE' | 'JUSTIFICADO' | 'INJUSTIFICADO'

interface Player {
  user_id: number
  name: string
  photo_url: string | null
  status: Status | null
  minutes_late: number | null
}

export default function Markings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [lateInputFor, setLateInputFor] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInfo, setDeleteInfo] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const allowed = user ? canManageAttendance(user.role) : false

  const load = async (d: string) => {
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      const data = await getAttendanceDay(d)
      setPlayers(
        data.records.map((r: any) => ({
          user_id: r.user_id,
          name: r.name,
          photo_url: r.photo_url,
          status: r.status as Status | null,
          minutes_late: r.minutes_late ?? null,
        })),
      )
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a carregar o dia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (allowed) load(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, allowed])

  useEffect(() => {
    const handler = () => {
      if (allowed) load(date)
    }
    window.addEventListener('data-changed', handler)
    return () => window.removeEventListener('data-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, allowed])

  const setPlayerStatus = (userId: number, status: Status) => {
    setPlayers((ps) =>
      ps.map((p) => {
        if (p.user_id !== userId) return p
        if (p.status === status) return { ...p, status: null, minutes_late: null }
        const keepMinutes = status === 'PRESENTE' ? p.minutes_late : null
        return { ...p, status, minutes_late: keepMinutes }
      }),
    )
    setLateInputFor(null)
  }

  const setPlayerMinutes = (userId: number, minutes: number | null) => {
    setPlayers((ps) =>
      ps.map((p) => (p.user_id === userId ? { ...p, minutes_late: minutes } : p)),
    )
  }

  const markAll = (status: Status) => {
    setPlayers((ps) => ps.map((p) => ({ ...p, status, minutes_late: null })))
    setLateInputFor(null)
  }

  const save = async () => {
    const records = players
      .filter((p) => p.status !== null)
      .map((p) => ({
        user_id: p.user_id,
        status: p.status!,
        minutes_late: p.status === 'PRESENTE' && p.minutes_late ? p.minutes_late : null,
      }))
    if (records.length === 0) {
      setError('Marca pelo menos um atleta antes de guardar.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await markAttendance(date, records)
      if (result?.fine_errors?.length > 0) {
        setError(
          `Presenças guardadas, mas ${result.fine_errors.length} multa(s) automática(s) falharam: ` +
            `${result.fine_errors.join(' · ')} — verifica se o seed dos tipos de multa foi corrido.`,
        )
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
      window.dispatchEvent(new CustomEvent('data-changed'))
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a guardar.')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = async () => {
    try {
      const info = await getAttendanceDayCount(date)
      setDeleteInfo(info)
      setShowDeleteConfirm(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro.')
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteAttendanceDay(date)
      setShowDeleteConfirm(false)
      await load(date)
      window.dispatchEvent(new CustomEvent('data-changed'))
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a apagar.')
    } finally {
      setDeleting(false)
    }
  }

  const changeDateBy = (days: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + days)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDate(`${yyyy}-${mm}-${dd}`)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const hasAnyMarked = players.some((p) => p.status !== null)

  const counts = {
    PRESENTE: players.filter((p) => p.status === 'PRESENTE').length,
    JUSTIFICADO: players.filter((p) => p.status === 'JUSTIFICADO').length,
    INJUSTIFICADO: players.filter((p) => p.status === 'INJUSTIFICADO').length,
  }

  if (!allowed) {
    return (
      <div className="px-5 py-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-danger-soft flex items-center justify-center mb-4">
          <ShieldAlert size={26} strokeWidth={1.75} className="text-danger" />
        </div>
        <p className="text-sm font-bold text-text">Sem permissão</p>
        <p className="text-xs text-text-muted mt-1 max-w-[260px]">
          Só a Equipa Técnica e o Admin podem marcar presenças.
        </p>
      </div>
    )
  }

  return (
    <div className="page space-y-4 pb-32">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">Marcar</h1>
          <p className="text-sm text-text-muted mt-0.5">Regista as presenças do treino</p>
        </div>
        {hasAnyMarked && (
          <button
            onClick={openDeleteConfirm}
            className="w-10 h-10 rounded-xl bg-danger-soft flex items-center justify-center shrink-0"
            aria-label="Apagar treino"
          >
            <Trash2 size={18} strokeWidth={2} className="text-danger" />
          </button>
        )}
      </div>

      <section className="card lift p-3 flex items-center justify-between gap-2">
        <button
          onClick={() => changeDateBy(-1)}
          className="pressable w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center shrink-0"
          aria-label="Dia anterior"
        >
          <ChevronLeft size={20} strokeWidth={2} className="text-text-muted" />
        </button>
        <button
          type="button"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'date'
            input.value = date
            input.onchange = (e) => setDate((e.target as HTMLInputElement).value)
            input.showPicker?.()
          }}
          className="pressable text-center flex-1 min-w-0 rounded-lg px-2 py-1"
        >
          <p className="text-sm font-bold text-text capitalize truncate">
            {formatDate(date)}
          </p>
          <p className="text-[11px] text-primary font-semibold mt-0.5">
            tocar para mudar
          </p>
        </button>
        <button
          onClick={() => changeDateBy(1)}
          className="pressable w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center shrink-0"
          aria-label="Dia seguinte"
        >
          <ChevronRight size={20} strokeWidth={2} className="text-text-muted" />
        </button>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="card p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Presentes</p>
          <p className="text-xl font-extrabold text-success">{counts.PRESENTE}</p>
        </div>
        <div className="card p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Justif.</p>
          <p className="text-xl font-extrabold text-primary">{counts.JUSTIFICADO}</p>
        </div>
        <div className="card p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Injustif.</p>
          <p className="text-xl font-extrabold text-danger">{counts.INJUSTIFICADO}</p>
        </div>
      </section>

      <section className="flex gap-2">
        <button
          onClick={() => markAll('PRESENTE')}
          className="flex-1 py-2.5 bg-surface border border-border hover:border-success/40 text-success font-semibold rounded-button text-xs flex items-center justify-center gap-1.5 transition"
        >
          <CheckCheck size={14} strokeWidth={2.2} />
          Todos presentes
        </button>
        <button
          onClick={() => navigate('/assistant')}
          className="flex-1 py-2.5 bg-primary-soft border border-primary/30 hover:bg-primary/20 text-primary font-semibold rounded-button text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Sparkles size={14} strokeWidth={2.2} />
          Usar IA
        </button>
      </section>

      {error && (
        <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-xs">
          {error}
        </div>
      )}

      <section className="space-y-1.5">
        {loading && <p className="text-center text-text-muted text-sm py-8">A carregar...</p>}
        {!loading &&
          players.map((p) => (
            <div key={p.user_id} className="card p-2.5 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    p.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  )}
                </div>
                <span className="flex-1 text-sm font-medium text-text truncate">{p.name}</span>
                <div className="flex gap-1">
                  <StatusButton
                    active={p.status === 'PRESENTE'}
                    onClick={() => setPlayerStatus(p.user_id, 'PRESENTE')}
                    color="success"
                    icon={<Check size={16} strokeWidth={2.6} />}
                  />
                  <button
                    onClick={() => {
                      setPlayerStatus(p.user_id, 'PRESENTE')
                      setLateInputFor(lateInputFor === p.user_id ? null : p.user_id)
                    }}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                      p.minutes_late ? 'bg-primary text-bg' : 'bg-surface-2 text-primary'
                    }`}
                  >
                    <Timer size={16} strokeWidth={2.4} />
                  </button>
                  <StatusButton
                    active={p.status === 'JUSTIFICADO'}
                    onClick={() => setPlayerStatus(p.user_id, 'JUSTIFICADO')}
                    color="primary"
                    icon={<Clock size={16} strokeWidth={2.4} />}
                  />
                  <StatusButton
                    active={p.status === 'INJUSTIFICADO'}
                    onClick={() => setPlayerStatus(p.user_id, 'INJUSTIFICADO')}
                    color="danger"
                    icon={<X size={16} strokeWidth={2.6} />}
                  />
                </div>
              </div>

              {lateInputFor === p.user_id && (
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <span className="text-[11px] text-text-muted">Minutos:</span>
                  <input
                    type="number"
                    min={0}
                    value={p.minutes_late ?? ''}
                    onChange={(e) =>
                      setPlayerMinutes(p.user_id, e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-16 px-2 py-1 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary"
                    placeholder="0"
                  />
                  {p.minutes_late && p.minutes_late > 0 && (
                    <span className="text-[11px] text-primary font-semibold">
                      {(p.minutes_late * 0.5).toFixed(2)}€
                    </span>
                  )}
                  <button
                    onClick={() => setLateInputFor(null)}
                    className="ml-auto text-[11px] text-text-muted"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          ))}
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-md px-5 pb-24 pt-3 bg-gradient-to-t from-bg via-bg/95 to-transparent pointer-events-auto">
          <button
            onClick={save}
            disabled={saving}
            className="pressable w-full py-3.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-bg font-extrabold rounded-button flex items-center justify-center gap-2"
          >
            {saved ? (
              <>
                <Check size={18} strokeWidth={2.6} />
                Guardado!
              </>
            ) : saving ? (
              'A guardar...'
            ) : (
              <>
                <Save size={18} strokeWidth={2.2} />
                Guardar treino
              </>
            )}
          </button>
        </div>
      </div>

      {showDeleteConfirm && deleteInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-surface border-t border-border rounded-t-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center shrink-0">
                <Trash2 size={20} strokeWidth={2.2} className="text-danger" />
              </div>
              <div>
                <p className="text-base font-bold text-text">Apagar treino?</p>
                <p className="text-[11px] text-text-muted">
                  {new Date(date + 'T00:00:00').toLocaleDateString('pt-PT', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
            </div>

            <div className="bg-surface-2 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Presenças</span>
                <span className="text-text font-bold">{deleteInfo.attendance_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Multas automáticas</span>
                <span className="text-danger font-bold">
                  {deleteInfo.auto_fines_count} ({deleteInfo.auto_fines_total.toFixed(2)}€)
                </span>
              </div>
              <p className="text-[11px] text-text-dim pt-1.5 border-t border-border">
                As multas manuais ficam. As estatísticas recalculam.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-button text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-danger text-white font-bold rounded-button text-sm disabled:opacity-50"
              >
                {deleting ? 'A apagar...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}function StatusButton({
  active,
  onClick,
  color,
  icon,
}: {
  active: boolean
  onClick: () => void
  color: 'success' | 'primary' | 'danger'
  icon: React.ReactNode
}) {
  const palette = {
    success: { on: 'bg-success text-bg', off: 'bg-surface-2 text-success' },
    primary: { on: 'bg-primary text-bg', off: 'bg-surface-2 text-primary' },
    danger: { on: 'bg-danger text-white', off: 'bg-surface-2 text-danger' },
  }[color]
  return (
    <button
      onClick={onClick}
      className={`pressable w-8 h-8 rounded-lg flex items-center justify-center ${
        active ? palette.on : palette.off
      }`}
    >
      {icon}
    </button>
  )
}