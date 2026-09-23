import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { getUnreadCount, generateReminders } from '../lib/api'

interface Props {
  onClick: () => void
  refreshKey?: number
}

export default function NotificationBell({ onClick, refreshKey }: Props) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Lazy scheduler: gera lembretes de prazo/atraso antes de contar.
    // Fire-and-forget — se falhar, o contador funciona na mesma.
    generateReminders()
      .catch(() => null)
      .finally(() => {
        getUnreadCount()
          .then((r) => setCount(r.count))
          .catch(() => setCount(0))
      })
  }, [refreshKey])

  return (
    <button
      onClick={onClick}
      className="relative w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center transition-colors"
      aria-label="Notificações"
    >
      <Bell size={20} strokeWidth={1.9} className="text-text-muted" />
      {count > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}