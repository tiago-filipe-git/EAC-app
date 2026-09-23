import { useEffect, useState } from 'react'
import { TrendingUp, UserX, Percent } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { canManageAttendance } from '../lib/permissions'
import { getAttendanceSummary, getAttendanceLeaderboard } from '../lib/api'
import Calendar from '../components/Calendar'
import DayDetailSheet from '../components/DayDetailSheet'
import FaltasTabs, { type FaltasTab } from '../components/FaltasTabs'

interface DayData {
  date: string
  present: number
  justified: number
  unjustified: number
  total_marked: number
  pct: number
}

interface LeaderboardRow {
  user_id: number
  name: string
  photo_url: string | null
  total: number
  present: number
  justified: number
  unjustified: number
  total_faltas: number
  attendance_rate: number
}

export default function Attendance() {
  const { user } = useAuth()
  const today = new Date()
  const [year] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [summary, setSummary] = useState<any>(null)
  const [board, setBoard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [daySheet, setDaySheet] = useState<string | null>(null)
  const [faltasTab, setFaltasTab] = useState<FaltasTab>('total')

  const fetchAll = () => {
    Promise.all([
      getAttendanceSummary(year).catch(() => null),
      getAttendanceLeaderboard(year).catch(() => null),
    ])
      .then(([s, b]) => {
        setSummary(s)
        setBoard(b)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  useEffect(() => {
    const handler = () => fetchAll()
    window.addEventListener('data-changed', handler)
    return () => window.removeEventListener('data-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const daysOfMonth: DayData[] = (summary?.days || []).filter((d: DayData) => {
    const m = Number(d.date.slice(5, 7)) - 1
    return m === month
  })

  const prevMonth = () => setMonth((m) => (m === 0 ? 11 : m - 1))
  const nextMonth = () => setMonth((m) => (m === 11 ? 0 : m + 1))

  const monthDays = daysOfMonth
  const totalMarked = monthDays.reduce((s, d) => s + d.total_marked, 0)
  const totalPresent = monthDays.reduce((s, d) => s + d.present, 0)
  const monthPct = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0
  const monthUnjustified = monthDays.reduce((s, d) => s + d.unjustified, 0)

  const showManageHint = user && canManageAttendance(user.role)

  return (
    <div className="page space-y-5 pb-32 animate-rise">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Assiduidade
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Presenças da equipa em {year}
          </p>
        </div>
        <span className="chip bg-primary-soft text-primary border border-primary/20">
          {monthPct}% mês
        </span>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <div className="card p-3.5">
          <div className="flex items-center gap-1.5 text-text-dim mb-1">
            <Percent size={13} strokeWidth={2.2} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Taxa
            </span>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-text">
            {monthPct}
            <span className="text-sm text-text-muted ml-0.5">%</span>
          </p>
        </div>

        <div className="card p-3.5">
          <div className="flex items-center gap-1.5 text-text-dim mb-1">
            <TrendingUp size={13} strokeWidth={2.2} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Presentes
            </span>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-success">
            {totalPresent}
          </p>
        </div>

        <div className="card p-3.5">
          <div className="flex items-center gap-1.5 text-text-dim mb-1">
            <UserX size={13} strokeWidth={2.2} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Injust.
            </span>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-danger">
            {monthUnjustified}
          </p>
        </div>
      </section>

      {loading && (
        <p className="text-center text-text-muted text-sm py-8">A carregar...</p>
      )}

      {!loading && summary && (
        <Calendar
          year={year}
          month={month}
          days={daysOfMonth}
          onPrev={prevMonth}
          onNext={nextMonth}
          onDayClick={(d) => setDaySheet(d)}
        />
      )}

      {board && board.top_attendance?.length > 0 && (
        <section className="card lift p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
            Top assíduos
          </p>
          <div className="space-y-2.5">
            {board.top_attendance.slice(0, 5).map((r: LeaderboardRow, i: number) => {
              const max = board.top_attendance[0].attendance_rate || 1
              const pct = (r.attendance_rate / max) * 100
              return (
                <div key={r.user_id} className="animate-rise" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-text truncate">
                      {i + 1}. {r.name}
                    </span>
                    <span className="text-success font-bold ml-2 tabular-nums">
                      {r.attendance_rate}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bar-fill"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)', boxShadow: '0 0 10px rgba(52,211,153,0.4)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <FaltasTabs board={board} tab={faltasTab} onTab={setFaltasTab} />

      {showManageHint && (
        <div className="card p-4 text-center text-xs text-text-muted">
          Vai à tab <span className="text-primary font-semibold">Marcar</span> para
          registar as presenças de hoje.
        </div>
      )}

      <DayDetailSheet
        open={!!daySheet}
        date={daySheet}
        onClose={() => setDaySheet(null)}
      />
    </div>
  )
}