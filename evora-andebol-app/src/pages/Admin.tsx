import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2, ShieldAlert, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  listUsers,
  getUserDataCount,
  bulkDeleteUsers,
  deleteUser,
  setUserRole,
} from '../lib/api'

interface UserLite {
  id: number
  username: string
  name: string
  phone: string | null
  role: string
  photo_url: string | null
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  sindicato: 'Sindicato',
  equipa_tecnica: 'Equipa Técnica',
  jogador: 'Jogador',
}

const ASSIGNABLE = ['jogador', 'sindicato', 'equipa_tecnica']

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserLite[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmData, setConfirmData] = useState<{ user: UserLite; counts: any } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openRoleFor, setOpenRoleFor] = useState<number | null>(null)

  const isAdmin = user?.role === 'admin'

  const load = async () => {
    setLoading(true)
    try {
      setUsers(await listUsers())
      setSelected(new Set())
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="px-5 py-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-danger-soft flex items-center justify-center mb-4">
          <ShieldAlert size={26} strokeWidth={1.75} className="text-danger" />
        </div>
        <p className="text-sm font-bold text-text">Sem permissão</p>
      </div>
    )
  }

  const isEditable = (u: UserLite) => u.role !== 'admin' && u.id !== user?.id

  const toggleSelect = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const askConfirmSingle = async (u: UserLite) => {
    try {
      const counts = await getUserDataCount(u.id)
      setConfirmData({ user: u, counts })
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro.')
    }
  }

  const confirmDelete = async () => {
    if (!confirmData) return
    setDeleting(true)
    try {
      await deleteUser(confirmData.user.id)
      setConfirmData(null)
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro.')
    } finally {
      setDeleting(false)
    }
  }

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (!confirm(`Apagar ${ids.length} user(s)? Backup guardado automaticamente.`)) return
    try {
      await bulkDeleteUsers(ids)
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro.')
    }
  }

  const changeRole = async (u: UserLite, role: string) => {
    setOpenRoleFor(null)
    if (role === u.role) return
    try {
      await setUserRole(u.id, role)
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro.')
    }
  }

  return (
    <div className="page space-y-4 pb-32">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-text-muted text-xs hover:text-primary"
      >
        <ChevronLeft size={14} strokeWidth={2.2} />
        Voltar
      </button>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">Gestão de Users</h1>
        <p className="text-sm text-text-muted mt-0.5">{users.length} user(s) registados</p>
      </div>

      {selected.size > 0 && (
        <button
          onClick={bulkDelete}
          className="w-full py-3 bg-danger-soft border border-danger/40 text-danger font-bold rounded-button text-sm flex items-center justify-center gap-2"
        >
          <Trash2 size={14} strokeWidth={2.4} />
          Apagar {selected.size} selecionado(s)
        </button>
      )}

      {loading && <p className="text-center text-text-muted text-sm py-8">A carregar...</p>}

      {error && (
        <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-xs">
          {error}
        </div>
      )}

      <section className="space-y-2">
        {users.map((u) => {
          const editable = isEditable(u)
          return (
            <div key={u.id} className="card p-3 space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => toggleSelect(u.id)}
                  disabled={!editable}
                  className="w-5 h-5 accent-primary shrink-0 disabled:opacity-30"
                />
                <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                  {u.photo_url ? (
                    <img src={u.photo_url} alt={u.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    u.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text truncate">
                    {u.name}
                    {u.id === user?.id && (
                      <span className="text-[10px] text-primary ml-2 uppercase">tu</span>
                    )}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">
                    @{u.username}
                    {u.phone && ` · ${u.phone}`}
                  </p>
                </div>
                <button
                  onClick={() => askConfirmSingle(u)}
                  disabled={!editable}
                  className="w-9 h-9 rounded-lg bg-danger-soft flex items-center justify-center shrink-0 disabled:opacity-30"
                >
                  <Trash2 size={16} strokeWidth={2.2} className="text-danger" />
                </button>
              </div>

              {/* Role selector */}
              <div className="flex items-center gap-2 pl-8">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                  Role
                </span>
                {editable ? (
                  <div className="relative">
                    <button
                      onClick={() => setOpenRoleFor(openRoleFor === u.id ? null : u.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary-soft px-2.5 py-1 rounded-full"
                    >
                      {ROLE_LABEL[u.role] || u.role}
                      <ChevronDown size={12} strokeWidth={2.4} />
                    </button>
                    {openRoleFor === u.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 bg-surface border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                        {ASSIGNABLE.map((r) => (
                          <button
                            key={r}
                            onClick={() => changeRole(u, r)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-2 transition ${
                              u.role === r ? 'text-primary font-bold' : 'text-text'
                            }`}
                          >
                            {ROLE_LABEL[r]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-primary bg-primary-soft px-2.5 py-1 rounded-full">
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {confirmData && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setConfirmData(null)}>
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
                <p className="text-base font-bold text-text">Apagar {confirmData.user.name}?</p>
                <p className="text-[11px] text-text-muted">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <div className="bg-surface-2 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Multas</span>
                <span className="text-danger font-bold">{confirmData.counts.fines}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Presenças</span>
                <span className="text-danger font-bold">{confirmData.counts.attendance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Notificações</span>
                <span className="text-danger font-bold">{confirmData.counts.notifications}</span>
              </div>
              <p className="text-[11px] text-text-dim pt-1.5 border-t border-border">
                Backup será guardado em <code>backups/</code>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmData(null)}
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
}