import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('As passwords não coincidem.')
      return
    }
    if (phone && !/^9\d{8}$/.test(phone)) {
      setError('Telefone inválido (9 dígitos, começa por 9).')
      return
    }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) {
      setError('Username: 3-20 caracteres (letras, números, . _ -).')
      return
    }
    setLoading(true)
    try {
      await register(
        name.trim(),
        username.trim().toLowerCase(),
        password,
        phone.trim() || undefined,
      )
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro ao registar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-sm">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-1 text-text-muted text-xs mb-6 hover:text-primary transition"
        >
          <ChevronLeft size={14} strokeWidth={2.2} />
          Voltar
        </button>

        <div className="flex flex-col items-center mb-8">
          <img
            src="/apple-touch-icon.png"
            alt="Évora Andebol Clube"
            className="w-20 h-20 rounded-3xl mb-4 object-cover ring-1 ring-border"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-text text-center">
            Criar conta
          </h1>
          <p className="text-sm text-text-muted mt-1 text-center">
            Regista-te para começar
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-1 uppercase tracking-wide">
              Nome completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: João Silva"
              className="w-full px-4 py-3.5 bg-surface border border-border rounded-button text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
              required
              autoCorrect="off"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-1 uppercase tracking-wide">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: joao.silva"
              className="w-full px-4 py-3.5 bg-surface border border-border rounded-button text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
              required
              autoCapitalize="none"
              autoCorrect="off"
              minLength={3}
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-1 uppercase tracking-wide">
              Telefone <span className="text-text-dim normal-case">(opcional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="912345678"
              maxLength={9}
              className="w-full px-4 py-3.5 bg-surface border border-border rounded-button text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-1 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              className="w-full px-4 py-3.5 bg-surface border border-border rounded-button text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-1 uppercase tracking-wide">
              Confirmar password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="repetir password"
              className="w-full px-4 py-3.5 bg-surface border border-border rounded-button text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-bg font-extrabold rounded-button transition-colors"
          >
            {loading ? 'A criar conta...' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}