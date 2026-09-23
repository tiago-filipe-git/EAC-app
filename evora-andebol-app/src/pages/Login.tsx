import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(identifier, password)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Erro ao efetuar login.'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-bg relative overflow-hidden">
      {/* Glow subtil como nas referências */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-72"
        style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(245,184,0,0.16) 0%, rgba(245,184,0,0) 70%)' }}
      />
      <div className="w-full max-w-sm relative animate-rise">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/apple-touch-icon.png"
            alt="Évora Andebol Clube"
            className="w-24 h-24 rounded-3xl mb-5 object-cover ring-1 ring-border shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-text text-center">
            Évora Andebol Clube
          </h1>
          <p className="text-sm text-text-muted mt-1 text-center">
            Gestão de multas e assiduidade
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-button bg-danger-soft border border-danger/30 text-danger text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="field-label">
              Username ou telefone
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="input-field placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
              placeholder="ex: joao.silva"
              required
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div>
            <label className="field-label">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <Link
          to="/register"
          className="block text-center text-xs text-primary font-semibold mt-6"
        >
          Criar conta
        </Link>

        <p className="text-center text-[10px] text-text-dim mt-8 tracking-[0.2em]">
          ÉVORA ANDEBOL CLUBE · 1987
        </p>
      </div>
    </div>
  )
}