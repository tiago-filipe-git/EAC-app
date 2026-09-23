import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DayData {
  date: string
  present: number
  justified: number
  unjustified: number
  total_marked: number
  pct: number
}

interface Props {
  year: number
  month: number // 0-11
  days: DayData[]
  onPrev: () => void
  onNext: () => void
  onDayClick: (date: string) => void
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

export default function Calendar({ year, month, days, onPrev, onNext, onDayClick }: Props) {
  const dayMap = useMemo(() => {
    const m: Record<string, DayData> = {}
    for (const d of days) m[d.date] = d
    return m
  }, [days])

  const grid = useMemo(() => {
    const first = new Date(year, month, 1)
    const startWeekday = first.getDay() // 0=Dom
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: (string | null)[] = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push(iso)
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  const todayIso = new Date().toISOString().slice(0, 10)

  const getStyle = (pct: number) => {
    // Intensidade do dourado consoante a %
    const alpha = Math.max(0.08, pct / 100)
    return {
      backgroundColor: `rgba(245, 184, 0, ${alpha})`,
      color: pct >= 55 ? '#0b0b0d' : '#fafafa',
    }
  }

  return (
    <div className="card p-4 lift">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrev}
          className="pressable w-8 h-8 rounded-full hover:bg-surface-2 flex items-center justify-center"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} strokeWidth={2} className="text-text-muted" />
        </button>
        <p className="text-sm font-bold text-text">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          onClick={onNext}
          className="pressable w-8 h-8 rounded-full hover:bg-surface-2 flex items-center justify-center"
          aria-label="Mês seguinte"
        >
          <ChevronRight size={18} strokeWidth={2} className="text-text-muted" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-bold uppercase tracking-wider text-text-dim py-1"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((iso, i) => {
          if (!iso) return <div key={i} className="aspect-square" />
          const data = dayMap[iso]
          const isToday = iso === todayIso
          const dayNum = Number(iso.slice(-2))

          if (!data) {
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-semibold ${
                  isToday
                    ? 'border-2 border-primary text-primary'
                    : 'text-text-dim'
                }`}
              >
                {dayNum}
              </div>
            )
          }

          return (
            <button
              key={i}
              onClick={() => onDayClick(iso)}
              style={getStyle(data.pct)}
              className={`pressable aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-bold ${
                isToday ? 'ring-2 ring-primary today-pulse' : ''
              }`}
            >
              <span>{dayNum}</span>
              <span className="text-[9px] opacity-80">{Math.round(data.pct)}%</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 text-[10px] text-text-dim">
        <span>Menos</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((a) => (
            <span
              key={a}
              className="w-3 h-3 rounded"
              style={{ backgroundColor: `rgba(245, 184, 0, ${a})` }}
            />
          ))}
        </div>
        <span>Mais</span>
      </div>
    </div>
  )
}