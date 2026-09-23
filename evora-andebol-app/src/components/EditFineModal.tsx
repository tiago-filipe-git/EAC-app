import { useEffect, useState } from 'react'
import Modal from './Modal'
import { getFineTypes, updateFineType, type FineType } from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  fine: {
    id: number
    player_name: string
    fine_type_id: number
    quantity: number
  } | null
}

export default function EditFineModal({ open, onClose, onSuccess, fine }: Props) {
  const [types, setTypes] = useState<FineType[]>([])
  const [fineCode, setFineCode] = useState<number | ''>('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !fine) return
    setError('')
    setQuantity(fine.quantity)
    Promise.all([getFineTypes()])
      .then(([t]) => {
        setTypes(t)
        // Pré-seleciona o tipo atual
        const current = t.find((x) => x.id === fine.fine_type_id)
        setFineCode(current ? current.code_number : '')
      })
      .catch(() => setError('Erro a carregar tipos.'))
  }, [open, fine])

  const selectedType = types.find((t) => t.code_number === fineCode)
  const total = selectedType ? selectedType.base_value * quantity : 0

  const submit = async () => {
    if (!fine || !fineCode) {
      setError('Escolhe o tipo.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await updateFineType(fine.id, Number(fineCode), quantity)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro a alterar multa.')
    } finally {
      setLoading(false)
    }
  }

  if (!fine) return null

  return (
    <Modal open={open} onClose={onClose} title={`Editar multa #${fine.id}`}>
      <div className="space-y-4">
        <p className="text-xs text-text-muted">
          Atleta: <span className="text-text font-semibold">{fine.player_name}</span>
        </p>

        {error && (
          <div className="p-3 rounded-button bg-danger-soft border border-danger/30 text-danger text-xs font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="field-label">Novo tipo</label>
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
          <label className="field-label">Quantidade</label>
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Novo total</p>
            <p className="text-3xl font-extrabold tracking-tight text-primary mt-1">{total.toFixed(2)}€</p>
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? 'A guardar...' : 'Guardar alterações'}
        </button>
      </div>
    </Modal>
  )
}