import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Receipt,
  CheckCircle2,
  Clock,
  ChevronDown,
  Dumbbell,
  Trophy,
  Users,
  PiggyBank,
  Search,
  X,
  ArrowUpDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { canManageFines } from '../lib/permissions'
import {
  getFines,
  getFinesMine,
  updateFineStatus,
  deleteFine,
  bulkDeleteFines,
  getRankings,
  getPeDeMeia,
  type Rankings,
} from '../lib/api'
import EditFineModal from '../components/EditFineModal'
import RankingsTabs from '../components/RankingsTabs'

interface Fine {
  id: number
  user_id: number
  player_name: string
  fine_type_id: number
  reason: string
  category: string
  quantity: number
  amount: number
  status: 'PAGO' | 'PENDENTE'
  auto_generated: boolean
  created_at: string
  paid_at?: string | null
}

const CATEGORY_ORDER = ['TREINO', 'JOGO', 'GERAL']
const CATEGORY_LABEL: Record<string, string> = {
  TREINO: 'Treino',
  JOGO: 'Jogo',
  GERAL: 'Geral',
}
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  TREINO: <Dumbbell size={14} strokeWidth={2.2} />,
  JOGO: <Trophy size={14} strokeWidth={2.2} />,
  GERAL: <Users size={14} strokeWidth={2.2} />,
}

type PeriodFilter = 'tudo' | 'mes' | '30d' | 'ano'
type SortOrder = 'recentes' | 'antigas' | 'caras'

const PERIOD_LABEL: Record<PeriodFilter, string> = {
  tudo: 'Tudo',
  mes: 'Este mês',
  '30d': 'Últimos 30 dias',
  ano: 'Este ano',
}

const SORT_LABEL: Record<SortOrder, string> = {
  recentes: 'Recentes',
  antigas: 'Antigas',
  caras: 'Mais caras',
}

/** Remove acentos e põe em lowercase para busca flexível. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function Fines() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const initialView: 'todos' | 'minhas' =
    searchParams.get('view') === 'minhas' ? 'minhas' : 'todos'

  const [fines, setFines] = useState<Fine[]>([])
  const [rankings, setRankings] = useState<Rankings | null>(null)
  const [peDeMeia, setPeDeMeia] = useState<any>(null)
  const [rankingTab, setRankingTab] = useState<
    'devedores' | 'multados' | 'acumulado'
  >('devedores')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<Fine | null>(null)
  const [statusFilter, setStatusFilter] = useState<'pendentes' | 'pagas' | 'todas'>(
    'pendentes',
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'todos' | 'minhas'>(initialView)

  // Filtros
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set())
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('tudo')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recentes')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const manage = user ? canManageFines(user.role) : false
  const isMine = view === 'minhas' || user?.role === 'jogador'
  const showMineToggle = manage || user?.role === 'jogador'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      let f: any[]
      let r: Rankings | null = null
      if (isMine) {
        f = await getFinesMine().catch(() => [])
        setPeDeMeia(null)
      } else {
        const res = await Promise.all([
          getFines().catch(() => []),
          getRankings().catch(() => null),
          getPeDeMeia().catch(() => null),
        ])
        f = res[0]
        r = res[1]
        setPeDeMeia(res[2])
      }
      setFines(f)
      setRankings(r)
      setSelected(new Set())
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a carregar multas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    const handler = () => load()
    window.addEventListener('fine-applied', handler)
    window.addEventListener('data-changed', handler)
    return () => {
      window.removeEventListener('fine-applied', handler)
      window.removeEventListener('data-changed', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const changeView = (newView: 'todos' | 'minhas') => {
    setView(newView)
    window.history.replaceState(null, '', `/fines?view=${newView}`)
  }

  const toggleStatus = async (fine: Fine) => {
    const next = fine.status === 'PAGO' ? 'PENDENTE' : 'PAGO'
    try {
      await updateFineStatus(fine.id, next)
      load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro.')
    }
  }

  const remove = async (fine: Fine) => {
    if (!confirm(`Apagar multa #${fine.id} de ${fine.player_name}?`)) return
    try {
      await deleteFine(fine.id)
      load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro.')
    }
  }

  const bulkRemove = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (!confirm(`Apagar ${ids.length} multa(s) selecionada(s)?`)) return
    try {
      await bulkDeleteFines(ids)
      load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro.')
    }
  }

  const toggleSelect = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleCategory = (cat: string) => {
    const next = new Set(catFilter)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setCatFilter(next)
  }

  const toggleGroupCollapse = (cat: string) => {
    const next = new Set(collapsed)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setCollapsed(next)
  }

  const clearFilters = () => {
    setQuery('')
    setCatFilter(new Set())
    setPeriodFilter('tudo')
    setSortOrder('recentes')
  }

  const hasActiveFilters =
    query.trim().length > 0 ||
    catFilter.size > 0 ||
    periodFilter !== 'tudo' ||
    sortOrder !== 'recentes'

  // Totais globais (todos os fines carregados, independente dos filtros)
  const totalAmount = fines.reduce((s, f) => s + f.amount, 0)
  const totalPaid = fines
    .filter((f) => f.status === 'PAGO')
    .reduce((s, f) => s + f.amount, 0)
  const totalPending = totalAmount - totalPaid
  const countPending = fines.filter((f) => f.status === 'PENDENTE').length

  // Aplicar filtros
  const filteredFines = useMemo(() => {
    const q = normalize(query.trim())
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    let result = fines.filter((f) => {
      // Estado
      if (statusFilter === 'pendentes' && f.status !== 'PENDENTE') return false
      if (statusFilter === 'pagas' && f.status !== 'PAGO') return false

      // Categoria
      if (catFilter.size > 0 && !catFilter.has(f.category)) return false

      // Período
      if (periodFilter !== 'tudo') {
        const created = new Date(f.created_at)
        if (periodFilter === 'mes' && created < startOfMonth) return false
        if (periodFilter === '30d' && created < start30d) return false
        if (periodFilter === 'ano' && created < startOfYear) return false
      }

      // Busca
      if (q) {
        const haystack = normalize(
          `${f.player_name} ${f.reason} #${f.id} ${f.category}`,
        )
        if (!haystack.includes(q)) return false
      }

      return true
    })

    // Ordenação
    result = [...result].sort((a, b) => {
      if (sortOrder === 'recentes') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortOrder === 'antigas') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      // caras
      return b.amount - a.amount
    })

    return result
  }, [fines, statusFilter, catFilter, periodFilter, query, sortOrder])

  // Agrupar por categoria (só quando não há ordem "caras" — nesse caso é lista plana)
  const groups = useMemo(() => {
    if (sortOrder === 'caras') {
      // Lista plana ordenada por valor
      return [
        {
          cat: 'caras',
          items: filteredFines,
          total: filteredFines.reduce((s, f) => s + f.amount, 0),
          pending: filteredFines.filter((f) => f.status === 'PENDENTE').length,
        },
      ]
    }

    const byCat = new Map<string, Fine[]>()
    for (const f of filteredFines) {
      const cat = f.category || 'GERAL'
      if (!byCat.has(cat)) byCat.set(cat, [])
      byCat.get(cat)!.push(f)
    }

    const orderedKeys = [
      ...CATEGORY_ORDER.filter((c) => byCat.has(c)),
      ...Array.from(byCat.keys()).filter((c) => !CATEGORY_ORDER.includes(c)),
    ]

    return orderedKeys.map((cat) => ({
      cat,
      items: byCat.get(cat)!,
      total: byCat.get(cat)!.reduce((s, f) => s + f.amount, 0),
      pending: byCat.get(cat)!.filter((f) => f.status === 'PENDENTE').length,
    }))
  }, [filteredFines, sortOrder])

  return (
    <div className="page space-y-5 pb-32 animate-rise">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">Multas</h1>
        <p className="text-sm text-text-muted mt-1">
          {manage ? 'Gerir as multas de todos os atletas' : 'As tuas multas'}
        </p>
        <div className="mt-2">
          {showMineToggle && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeView('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  view === 'todos'
                    ? 'bg-primary text-bg'
                    : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => changeView('minhas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  view === 'minhas'
                    ? 'bg-primary text-bg'
                    : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                }`}
              >
                Minhas
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pé de meia — só na vista global */}
      {!isMine && peDeMeia && (
        <section className="hero-glow p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-tile rounded-xl!">
              <PiggyBank size={18} strokeWidth={2} className="text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Pé de meia
              </p>
              <p className="text-[10px] text-text-dim">Desde o início da época</p>
            </div>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-primary mt-1">
            {peDeMeia.total.toFixed(2)}
            <span className="text-lg text-text-muted ml-1">€</span>
          </p>
          <p className="text-[11px] text-text-muted mt-1">
            {peDeMeia.count} multa{peDeMeia.count === 1 ? '' : 's'} paga
            {peDeMeia.count === 1 ? '' : 's'} no total
          </p>
        </section>
      )}

      {/* Resumo */}
      <section className="hero-glow p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {isMine ? 'As minhas por liquidar' : 'Por liquidar (todas)'}
        </p>
        <p className="text-3xl font-extrabold tracking-tight text-text mt-1">
          {totalPending.toFixed(2)}
          <span className="text-lg text-text-muted ml-1">€</span>
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
          <MiniStat
            icon={<Receipt size={14} strokeWidth={2.2} />}
            label="Total"
            value={`${fines.length}`}
          />
          <MiniStat
            icon={<Clock size={14} strokeWidth={2.2} />}
            label="Pendentes"
            value={`${countPending}`}
            accent="danger"
          />
          <MiniStat
            icon={<CheckCircle2 size={14} strokeWidth={2.2} />}
            label="Recebido"
            value={`${totalPaid.toFixed(2)}€`}
            accent="success"
          />
        </div>
      </section>

      {/* Rankings — só na vista global */}
      {!isMine && (
        <RankingsTabs rankings={rankings} tab={rankingTab} onTab={setRankingTab} />
      )}

      {/* ===== FILTROS ===== */}
      <section className="space-y-3">
        {/* Busca */}
        <div className="relative">
          <Search
            size={16}
            strokeWidth={2.2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por atleta, motivo, ID..."
            className="w-full pl-10 pr-10 py-3 bg-surface border border-border rounded-button text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center"
            >
              <X size={12} strokeWidth={2.5} className="text-text-muted" />
            </button>
          )}
        </div>

        {/* Pills de categoria + período + sort */}
        <div className="flex flex-wrap items-center gap-2">
          {['TREINO', 'JOGO', 'GERAL'].map((cat) => {
            const active = catFilter.has(cat)
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  active
                    ? 'bg-primary text-bg'
                    : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                }`}
              >
                {CATEGORY_ICON[cat]}
                {CATEGORY_LABEL[cat]}
              </button>
            )
          })}

          <div className="relative">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="appearance-none px-3 py-1.5 pr-7 rounded-full text-[11px] font-bold bg-surface-2 border border-border text-text-muted hover:text-text focus:outline-none focus:border-primary cursor-pointer"
            >
              {(Object.keys(PERIOD_LABEL) as PeriodFilter[]).map((k) => (
                <option key={k} value={k}>
                  {PERIOD_LABEL[k]}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              strokeWidth={2.5}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
            />
          </div>

          <div className="relative ml-auto">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-surface-2 border border-border text-text-muted hover:text-text"
            >
              <ArrowUpDown size={12} strokeWidth={2.2} />
              {SORT_LABEL[sortOrder]}
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                  {(Object.keys(SORT_LABEL) as SortOrder[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        setSortOrder(k)
                        setShowSortMenu(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-2 transition ${
                        sortOrder === k ? 'text-primary font-bold' : 'text-text'
                      }`}
                    >
                      {SORT_LABEL[k]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Estado (Pendentes/Pagas/Todas) */}
        {!loading && fines.length > 0 && (
          <div
            role="tablist"
            aria-label="Filtrar por estado"
            className="flex gap-1 p-1 rounded-xl bg-[#0a0a0c] border border-border"
          >
            {(['pendentes', 'pagas', 'todas'] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={statusFilter === f}
                onClick={() => setStatusFilter(f)}
                className={`tab-pill flex-1 py-2 rounded-lg text-[12px] font-extrabold capitalize ${
                  statusFilter === f
                    ? 'bg-primary text-bg shadow-[0_4px_16px_rgba(245,184,0,0.35)]'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Contador de resultados + limpar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] text-text-muted">
              <span className="text-text font-bold">{filteredFines.length}</span>{' '}
              de {fines.length} multa{fines.length === 1 ? '' : 's'}
            </p>
            <button
              onClick={clearFilters}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </section>

      {/* Bulk actions */}
      {manage && selected.size > 0 && (
        <button
          onClick={bulkRemove}
          className="w-full py-3 bg-danger-soft border border-danger/40 text-danger font-bold rounded-button text-sm"
        >
          Apagar {selected.size} selecionada(s)
        </button>
      )}

      {loading && (
        <p className="text-center text-text-muted text-sm py-8">A carregar...</p>
      )}

      {error && (
        <div className="p-3 rounded-button bg-danger-soft border border-danger/30 text-danger text-xs">
          {error}
        </div>
      )}

      {!loading && fines.length === 0 && (
        <p className="text-center text-text-dim text-sm py-8">
          {isMine ? 'Não tens multas registadas.' : 'Sem multas registadas.'}
        </p>
      )}

      {!loading && fines.length > 0 && filteredFines.length === 0 && (
        <div className="text-center py-8">
          <p className="text-text-dim text-sm">Nenhum resultado.</p>
          <button
            onClick={clearFilters}
            className="text-primary text-xs font-semibold mt-2 hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Lista agrupada */}
      <div className="space-y-4">
        {groups.map(({ cat, items, total, pending }) => {
          const isCollapsed = collapsed.has(cat)
          const isFlat = cat === 'caras'
          return (
            <section key={cat} className="space-y-2">
              {!isFlat && (
                <button
                  onClick={() => toggleGroupCollapse(cat)}
                  className="w-full flex items-center justify-between gap-2 px-1"
                >
                  <div className="flex items-center gap-2 text-text-muted">
                    {CATEGORY_ICON[cat] || <Receipt size={14} strokeWidth={2.2} />}
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      {CATEGORY_LABEL[cat] || cat}
                    </span>
                    <span className="text-[10px] text-text-dim">
                      ({items.length}
                      {pending > 0 ? ` · ${pending} pend.` : ''})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary tabular-nums">
                      {total.toFixed(2)}€
                    </span>
                    <ChevronDown
                      size={16}
                      strokeWidth={2.2}
                      className={`text-text-dim transition-transform ${
                        isCollapsed ? '' : 'rotate-180'
                      }`}
                    />
                  </div>
                </button>
              )}

              {!isCollapsed && (
                <section className="space-y-2">
                  {items.map((f) => (
                    <div
                      key={f.id}
                      className={`card p-3.5 transition ${
                        selected.has(f.id) ? 'border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {manage && (
                          <input
                            type="checkbox"
                            checked={selected.has(f.id)}
                            onChange={() => toggleSelect(f.id)}
                            className="mt-1 w-5 h-5 accent-primary shrink-0"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] text-text-dim font-medium">
                                #{f.id} · {f.player_name}
                                {f.auto_generated && (
                                  <span className="ml-2 text-[10px] text-primary font-semibold uppercase tracking-wide">
                                    auto
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-text mt-0.5 break-words leading-snug">
                                {f.reason}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                f.status === 'PAGO'
                                  ? 'bg-success-soft text-success'
                                  : 'bg-danger-soft text-danger'
                              }`}
                            >
                              {f.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-2.5">
                            <p className="text-primary font-extrabold text-base">
                              {f.amount.toFixed(2)}€
                            </p>

                            {manage && (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setEditing(f)}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-border text-text font-semibold"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => toggleStatus(f)}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-border text-text font-semibold"
                                >
                                  {f.status === 'PAGO' ? 'Pendente' : 'Pago'}
                                </button>
                                <button
                                  onClick={() => remove(f)}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-danger-soft text-danger font-semibold"
                                >
                                  Apagar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </section>
          )
        })}
      </div>

      <EditFineModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSuccess={load}
        fine={editing}
      />
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: 'danger' | 'success'
}) {
  const color =
    accent === 'danger'
      ? 'text-danger'
      : accent === 'success'
        ? 'text-success'
        : 'text-text'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-text-dim">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-base font-extrabold ${color}`}>{value}</p>
    </div>
  )
}