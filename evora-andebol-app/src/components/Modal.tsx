import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface border-t sm:border border-border rounded-t-3xl sm:rounded-card max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex justify-between items-center rounded-t-3xl sm:rounded-t-card">
          <h2 className="text-sm font-extrabold tracking-tight text-text">{title}</h2>
          <button
            onClick={onClose}
            className="pressable w-8 h-8 rounded-full bg-surface-2 hover:bg-border flex items-center justify-center text-text-muted hover:text-text text-base leading-none"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}