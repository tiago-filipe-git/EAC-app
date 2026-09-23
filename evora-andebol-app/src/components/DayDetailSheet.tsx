import { useEffect, useState } from 'react'
import { X, Check, Clock, XCircle, Calendar } from 'lucide-react'
import { getAttendanceDay } from '../lib/api'

interface Props {
  open: boolean
  date: string | null
  onClose: () => void
}

interface AttendanceRecord {
  user_id: number
  name: string
  photo_url: string | null
  status: string | null
  marked_at: string | null
}

export default function DayDetailSheet({ open, date, onClose }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !date) return
    setLoading(true)
    getAttendanceDay(date)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [open, date])

  if (!open || !date) return null

  const grouped = (data?.records || []).reduce(
    (acc: Record<string, AttendanceRecord[]>, r: AttendanceRecord) => {
      const key = r.status || 'NAO_MARCADO'
      if (!acc[key]) acc[key] = []
      acc[key].push(r)
      return acc
    },
    {} as Record<string, AttendanceRecord[]>,
  )

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-surface border-t border-border rounded-t-3xl max-h-[80vh] flex flex-col animate-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Calendar size={18} strokeWidth={2} className="text-primary" />
            <div>
              <p className="text-sm font-bold text-text capitalize">
                {formatDate(date)}
              </p>
              {data && (
                <p className="text-[11px] text-text-muted">
                  {data.present} presentes · {data.justified} justif. ·{' '}
                  {data.unjustified} injustif.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center"
          >
            <X size={20} strokeWidth={2} className="text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <p className="text-center text-text-muted text-sm py-8">A carregar...</p>
          )}

          {data && (
            <>
              {grouped.PRESENTE?.length > 0 && (
                <Section
                  icon={<Check size={14} strokeWidth={2.4} />}
                  title="Presentes"
                  color="text-success"
                  records={grouped.PRESENTE}
                />
              )}
              {grouped.JUSTIFICADO?.length > 0 && (
                <Section
                  icon={<Clock size={14} strokeWidth={2.4} />}
                  title="Faltas justificadas"
                  color="text-primary"
                  records={grouped.JUSTIFICADO}
                />
              )}
              {grouped.INJUSTIFICADO?.length > 0 && (
                <Section
                  icon={<XCircle size={14} strokeWidth={2.4} />}
                  title="Faltas injustificadas"
                  color="text-danger"
                  records={grouped.INJUSTIFICADO}
                />
              )}
              {grouped.NAO_MARCADO?.length > 0 && (
                <Section
                  icon={<Clock size={14} strokeWidth={2.4} />}
                  title="Não marcados"
                  color="text-text-dim"
                  records={grouped.NAO_MARCADO}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  icon,
  title,
  color,
  records,
}: {
  icon: React.ReactNode
  title: string
  color: string
  records: AttendanceRecord[]
}) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
        {icon}
        <p className="text-[11px] font-bold uppercase tracking-wider">
          {title} ({records.length})
        </p>
      </div>
      <div className="space-y-1">
        {records.map((r) => (
          <div
            key={r.user_id}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-surface-2"
          >
            <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
              {r.photo_url ? (
                <img
                  src={r.photo_url}
                  alt={r.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                r.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              )}
            </div>
            <span className="text-xs text-text font-medium truncate">
              {r.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}