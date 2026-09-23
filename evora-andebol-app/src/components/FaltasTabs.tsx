import { useEffect, useRef, useState } from 'react'
import { UserX } from 'lucide-react'

export type FaltasTab = 'total' | 'injustificadas' | 'justificadas'

interface FaltasRow {
  user_id: number
  name: string
  total: number
  justified: number
  unjustified: number
  total_faltas: number
  total_faltas_pct: number
  justified_pct: number
  unjustified_pct: number
}

interface Board {
  top_absent: FaltasRow[]
  top_unjustified: FaltasRow[]
  top_justified: FaltasRow[]
}

const TABS: { key: FaltasTab; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'injustificadas', label: 'Injustif.' },
  { key: 'justificadas', label: 'Justif.' },
]

const MEDALS = ['1.', '2.', '3.']

const TAB_STYLE: Record<FaltasTab, { value: string; bar: string; glow: string }> = {
  total: {
    value: 'text-primary',
    bar: 'linear-gradient(90deg, #d9a400, #f5b800)',
    glow: '0 0 12px rgba(245, 184, 0, 0.4)',
  },
  injustificadas: {
    value: 'text-primary',
    bar: 'linear-gradient(90deg, #d9a400, #f5b800)',
    glow: '0 0 12px rgba(245, 184, 0, 0.4)',
  },
  justificadas: {
    value: 'text-primary',
    bar: 'linear-gradient(90deg, #d9a400, #f5b800)',
    glow: '0 0 12px rgba(245, 184, 0, 0.4)',
  },
}

function AnimatedBar({ pct, bar, glow }: { pct: number; bar: string; glow: string }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setW(pct)))
    return () => cancelAnimationFrame(raf)
  }, [pct])
  return (
    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <div
        className="h-full rounded-full bar-fill"
        style={{ width: `${w}%`, background: bar, boxShadow: glow }}
      />
    </div>
  )
}

export default function FaltasTabs({
  board,
  tab,
  onTab,
}: {
  board: Board | null
  tab: FaltasTab
  onTab: (t: FaltasTab) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.classList.remove('animate-fade')
    void el.offsetWidth
    el.classList.add('animate-fade')
  }, [tab])

  if (!board) return null

  const rows =
    tab === 'total'
      ? (board.top_absent || []).map((r) => ({
          ...r,
          value: r.total_faltas,
          pct: r.total_faltas_pct,
        }))
      : tab === 'injustificadas'
        ? (board.top_unjustified || []).map((r) => ({
            ...r,
            value: r.unjustified,
            pct: r.unjustified_pct,
          }))
        : (board.top_justified || []).map((r) => ({
            ...r,
            value: r.justified,
            pct: r.justified_pct,
          }))

  const visiveis = rows.filter((r) => r.value > 0)
  const max = visiveis[0]?.value || 1
  const style = TAB_STYLE[tab]

  return (
    <section className="card lift p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserX size={16} strokeWidth={2.2} className="text-primary" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Mais faltas
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Faltas"
        className="flex gap-1 p-1 rounded-xl bg-[#0a0a0c] border border-border mb-4"
      >
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => onTab(t.key)}
              className={`tab-pill flex-1 py-2 rounded-lg text-[12px] font-extrabold ${
                active
                  ? 'bg-primary text-bg shadow-[0_4px_16px_rgba(245,184,0,0.35)]'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {visiveis.length === 0 ? (
        <p className="text-center text-text-dim text-xs py-3">Sem faltas registadas.</p>
      ) : (
        <div ref={listRef} className="space-y-3">
          {visiveis.slice(0, 5).map((r, i) => {
            const pct = Math.max(4, (r.value / max) * 100)
            return (
              <div
                key={r.user_id}
                className="animate-rise"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="flex justify-between items-baseline text-xs mb-1.5 gap-2">
                  <span className="font-bold text-text truncate">
                    <span className="mr-1.5">{MEDALS[i]}</span>
                    {r.name}
                  </span>
                  <span
                    className={`font-extrabold ml-2 whitespace-nowrap tabular-nums ${style.value}`}
                  >
                    {r.value} falta{r.value === 1 ? '' : 's'}
                  </span>
                </div>
                <AnimatedBar pct={pct} bar={style.bar} glow={style.glow} />
                <p className="text-[10px] text-text-dim mt-1 tabular-nums">
                  {r.pct}% dos treinos ({r.total} no total)
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}