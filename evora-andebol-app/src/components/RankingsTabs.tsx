import { useEffect, useRef, useState } from 'react'
import { Trophy } from 'lucide-react'
import type { Rankings } from '../lib/api'

export type RankingTab = 'devedores' | 'multados' | 'acumulado'

const RANKING_TABS: { key: RankingTab; label: string }[] = [
  { key: 'devedores', label: 'Devedores' },
  { key: 'multados', label: 'Multados' },
  { key: 'acumulado', label: 'Acumulado' },
]

const MEDALS = ['1.', '2.', '3.']

/** Cor por tab — as 3 usam o mesmo amarelo. */
const TAB_STYLE: Record<RankingTab, { value: string; bar: string; glow: string }> = {
  devedores: {
    value: 'text-primary',
    bar: 'linear-gradient(90deg, #d9a400, #f5b800)',
    glow: '0 0 12px rgba(245, 184, 0, 0.4)',
  },
  multados: {
    value: 'text-text',
    bar: 'linear-gradient(90deg, #d9a400, #f5b800)',
    glow: '0 0 12px rgba(245, 184, 0, 0.4)',
  },
  acumulado: {
    value: 'text-primary',
    bar: 'linear-gradient(90deg, #d9a400, #ffc926)',
    glow: '0 0 12px rgba(245, 184, 0, 0.4)',
  },
}

/** Barra que anima de 0 até ao valor (palpável). */
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

export default function RankingsTabs({
  rankings,
  tab,
  onTab,
}: {
  rankings: Rankings | null
  tab: RankingTab
  onTab: (t: RankingTab) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  // Re-dispara a animação de entrada das linhas ao trocar de tab
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.classList.remove('animate-fade')
    void el.offsetWidth
    el.classList.add('animate-fade')
  }, [tab])

  if (!rankings) return null

  const rows =
    tab === 'devedores'
      ? rankings.top_debtors.map((r) => ({ ...r, value: r.pending, suffix: '€' }))
      : tab === 'multados'
        ? rankings.top_offenders.map((r) => ({ ...r, value: r.count, suffix: '' }))
        : rankings.top_accumulated.map((r) => ({ ...r, value: r.total, suffix: '€' }))

  const visiveis = rows.filter((r) => r.value > 0)
  const max = visiveis[0]?.value || 1
  const style = TAB_STYLE[tab]
  const euro = '\u20AC'

  return (
    <section className="card p-4 lift">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={16} strokeWidth={2.2} className="text-primary" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Rankings
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Rankings"
        className="flex gap-1 p-1 rounded-xl bg-[#0a0a0c] border border-border mb-4"
      >
        {RANKING_TABS.map((t) => {
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
        <p className="text-center text-text-dim text-xs py-3">
          {tab === 'devedores'
            ? 'Sem dívidas pendentes'
            : tab === 'multados'
              ? 'Sem multas registadas.'
              : 'Sem valores acumulados.'}
        </p>
      ) : (
        <div ref={listRef} className="space-y-3">
          {visiveis.map((r, i) => {
            const pct = Math.max(4, (r.value / max) * 100)
            const isMoney = r.suffix === '€'
            return (
              <div key={r.user_id} className="animate-rise" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex justify-between items-baseline text-xs mb-1.5 gap-2">
                  <span className="font-bold text-text truncate">
                    <span className="mr-1.5">{MEDALS[i]}</span>
                    {r.name}
                  </span>
                  <span className={`font-extrabold ml-2 whitespace-nowrap tabular-nums ${style.value}`}>
                    {isMoney ? `${r.value.toFixed(2)}${euro}` : `${r.value} multa(s)`}
                  </span>
                </div>
                <AnimatedBar pct={pct} bar={style.bar} glow={style.glow} />
                <p className="text-[10px] text-text-dim mt-1 tabular-nums">
                  {tab === 'devedores' && `${r.count} multa(s) no total`}
                  {tab === 'multados' && `Acumulado: ${r.total.toFixed(2)}${euro}`}
                  {tab === 'acumulado' && `${r.pending.toFixed(2)}${euro} por liquidar`}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
