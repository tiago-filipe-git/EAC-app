import { useEffect, useState } from 'react'
import Modal from './Modal'
import { applyFine, getFineTypes, getUsers, type FineType, type UserLite } from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ApplyFineModal({ open, onClose, onSuccess }: Props) {
  const [users, setUsers] = useState<UserLite[]>([])
  const [types, setTypes] = useState<FineType[]>([])
  const [userId, setUserId] = useState<number | ''>('')
  const [fineCode, setFineCode] = useState<number | ''>('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setUserId('')
    setFineCode('')
    setQuantity(1)
    Promise.all([getUsers(), getFineTypes()])
      .then(([u, t]) => {
        setUsers(u)
        setTypes(t)
      })
      .catch(() => setError('Erro a carregar dados.'))
  }, [open])

  const selectedType = types.find((t) => t.code_number === fineCode)
  const total = selectedType ? selectedType.base_value * quantity : 0

  const submit = async () => {
    if (!userId || !fineCode) {
      setError('Escolhe o atleta e o tipo de multa.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await applyFine({
        user_id: Number(userId),
        fine_code: Number(fineCode),
        quantity,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a aplicar multa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova multa">
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-button bg-danger-soft border border-danger/30 text-danger text-xs font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="field-label">Atleta</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}
            className="input-field focus:outline-none focus:border-primary"
          >
            <option value="">— Escolhe —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Tipo de multa</label>
          <select
            value={fineCode}
            onChange={(e) => setFineCode(e.target.value ? Number(e.target.value) : '')}
            className="input-field focus:outline-none focus:border-primary"
          >
            <option value="">— Escolhe —</option>
            {types.map((t) => (
              <option key={t.code_number} value={t.code_number}>
                #{t.code_number} · {t.description} ({t.base_value}€)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">
            Quantidade {selectedType?.description.includes('minuto') && '(minutos)'}
          </label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="input-field focus:outline-none focus:border-primary"
          />
        </div>

        {selectedType && (
          <div className="hero-glow p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Total a aplicar</p>
            <p className="text-3xl font-extrabold tracking-tight text-primary mt-1">{total.toFixed(2)}€</p>
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? 'A aplicar...' : 'Aplicar multa'}
        </button>
      </div>
    </Modal>
  )
}