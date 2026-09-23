import { useEffect, useState } from 'react'
import { AtSign, KeyRound, Lock, Phone, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { updateMe } from '../lib/api'
import type { UpdateMePayload } from '../lib/api'

const PHONE_HINT = '9 dígitos, começa por 9'

const INPUT_CLASS =
  'w-full px-3.5 py-3 pl-10 bg-surface-2 border border-border rounded-button text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary/60'

/** O próprio user altera username, telemóvel e palavra-passe.
 *  O nome/apelido é fixo — só um admin o pode alterar (via /admin). */
export default function AccountSettings() {
  const { user, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    if (!user) return
    setUsername(user.username)
    setPhone(user.phone ?? '')
  }, [user])

  if (!user) return null

  const close = () => {
    setUsername(user.username)
    setPhone(user.phone ?? '')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setOpen(false)
  }

  const submit = async () => {
    setError('')
    setDone('')

    const payload: UpdateMePayload = {}
    if (username.trim().toLowerCase() !== user.username) payload.username = username.trim()
    const phoneTrim = phone.trim()
    if (phoneTrim !== (user.phone ?? '')) payload.phone = phoneTrim
    if (newPassword || confirmPassword || currentPassword) {
      if (newPassword !== confirmPassword) {
        setError('As palavras-passe novas não coincidem.')
        return
      }
      if (newPassword.length < 6) {
        setError('A nova palavra-passe tem de ter 6+ caracteres.')
        return
      }
      payload.current_password = currentPassword
      payload.new_password = newPassword
    }
    if (Object.keys(payload).length === 0) {
      setError('Não alteraste nada.')
      return
    }

    setSaving(true)
    try {
      const res = await updateMe(payload)
      updateUser({ ...user, username: res.user.username, phone: res.user.phone })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setOpen(false)
      setDone('Dados da conta atualizados.')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a guardar os dados.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-text-dim">
          <KeyRound size={14} strokeWidth={2.2} />
          <p className="text-[10px] font-semibold uppercase tracking-wider">
            Dados da conta
          </p>
        </div>
        <button
          onClick={() => (open ? close() : setOpen(true))}
          className="text-[10px] font-bold text-primary uppercase tracking-wider"
        >
          {open ? 'Cancelar' : 'Alterar'}
        </button>
      </div>

      {!open && (
        <div className="space-y-1.5">
          <p className="text-xs text-text-muted">
            {user.name}
            <span className="text-text-dim"> · nome fixo</span>
          </p>
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <AtSign size={12} strokeWidth={2.2} className="text-text-dim" />
            {user.username}
          </p>
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <Phone size={12} strokeWidth={2.2} className="text-text-dim" />
            {user.phone || <span className="text-text-dim">sem telemóvel</span>}
          </p>
        </div>
      )}

      {open && (
        <div className="space-y-3">
          {error && (
            <div className="p-3 rounded-button bg-danger-soft border border-danger/30 text-danger text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
              Nome e apelido
            </label>
            <div className="flex items-center gap-2 px-3.5 py-3 bg-surface-2/50 border border-border rounded-button">
              <UserIcon size={16} strokeWidth={2.2} className="text-text-dim shrink-0" />
              <span className="text-sm text-text-muted">{user.name}</span>
              <Lock size={12} strokeWidth={2.2} className="text-text-dim ml-auto shrink-0" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
              Username
            </label>
            <div className="relative">
              <AtSign
                size={16}
                strokeWidth={2.2}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
              />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
              Telemóvel
            </label>
            <div className="relative">
              <Phone
                size={16}
                strokeWidth={2.2}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
              />
              <input
                value={phone}
                inputMode="numeric"
                placeholder={PHONE_HINT}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
              Palavra-passe atual
            </label>
            <div className="relative">
              <Lock
                size={16}
                strokeWidth={2.2}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
              />
              <input
                type="password"
                value={currentPassword}
                placeholder="obrigatória para mudar a palavra-passe"
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
                Nova palavra-passe
              </label>
              <div className="relative">
                <KeyRound
                  size={16}
                  strokeWidth={2.2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type="password"
                  value={newPassword}
                  placeholder="6+ caracteres"
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
                Repetir nova palavra-passe
              </label>
              <div className="relative">
                <KeyRound
                  size={16}
                  strokeWidth={2.2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  placeholder="6+ caracteres"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-3 bg-primary text-bg font-bold rounded-button text-sm disabled:opacity-60"
          >
            {saving ? 'A guardar...' : 'Guardar alterações'}
          </button>
        </div>
      )}

      {done && !open && (
        <p className="text-xs text-primary font-semibold">{done}</p>
      )}
    </section>
  )
}
