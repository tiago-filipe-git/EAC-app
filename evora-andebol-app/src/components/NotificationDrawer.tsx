import { useEffect, useState } from 'react'
import { X, Bell, CheckCheck } from 'lucide-react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

interface Notif {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

export default function NotificationDrawer({ open, onClose, onChanged }: Props) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getNotifications()
      setNotifs(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const handleRead = async (id: number) => {
    await markNotificationRead(id)
    await load()
    onChanged?.()
  }

  const handleReadAll = async () => {
    await markAllNotificationsRead()
    await load()
    onChanged?.()
  }

  if (!open) return null

  const unread = notifs.filter((n) => !n.read).length

  return (
    <div className="fixed inset-0 z-50 flex justify-center animate-fade" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md h-full flex flex-col bg-bg animate-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center">
            <Bell size={18} strokeWidth={2} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-text">Notificações</p>
            <p className="text-[11px] text-text-muted">
              {unread > 0 ? `${unread} não lida(s)` : 'Sem novas'}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={handleReadAll}
              className="text-[11px] font-semibold text-primary flex items-center gap-1"
            >
              <CheckCheck size={14} strokeWidth={2.2} />
              Marcar todas
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center transition-colors"
          >
            <X size={20} strokeWidth={2} className="text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <p className="text-center text-text-muted text-sm py-8">A carregar...</p>
          )}
          {!loading && notifs.length === 0 && (
            <div className="text-center py-16">
              <Bell size={40} strokeWidth={1.5} className="text-text-dim mx-auto mb-3" />
              <p className="text-sm text-text-muted">Sem notificações</p>
            </div>
          )}
          {notifs.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read && handleRead(n.id)}
              className={`w-full text-left card p-3.5 transition ${
                !n.read ? 'border-primary/40' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text">{n.title}</p>
                  <p className="text-xs text-text-muted mt-0.5 leading-snug">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-text-dim mt-1.5">
                    {new Date(n.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}