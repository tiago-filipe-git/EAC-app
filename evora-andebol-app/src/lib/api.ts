import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

// ---------- Auth ----------
export const login = async (identifier: string, password: string) => {
  const formData = new FormData()
  formData.append('username', identifier)
  formData.append('password', password)
  const res = await api.post('/auth/login', formData)
  return res.data
}

export const register = async (
  name: string,
  username: string,
  password: string,
  phone?: string,
) =>
  (
    await api.post('/auth/register', {
      name,
      username,
      password,
      phone: phone || null,
    })
  ).data

// ---------- Fines ----------
export interface FineType {
  id: number
  code_number: number
  category: string
  description: string
  calculation_type: string
  base_value: number
}

export interface UserLite {
  id: number
  name: string
}

export const getFines = async () => (await api.get('/fines')).data
export const getFinesMine = async () => (await api.get('/fines/mine')).data
export const getFinesOfUser = async (userId: number) =>
  (await api.get(`/fines/user/${userId}`)).data
export const applyFine = async (payload: { user_id: number; fine_code: number; quantity?: number }) =>
  (await api.post('/fines/apply', payload)).data
export const updateFineStatus = async (id: number, status: 'PAGO' | 'PENDENTE') =>
  (await api.patch(`/fines/${id}/status`, { status })).data
export const updateFineType = async (id: number, fine_code: number, quantity?: number) =>
  (await api.patch(`/fines/${id}`, { fine_code, quantity })).data
export const deleteFine = async (id: number) => (await api.delete(`/fines/${id}`)).data
export const bulkDeleteFines = async (ids: number[]) =>
  (await api.post('/fines/bulk-delete', { ids })).data
export const getFineTypes = async (): Promise<FineType[]> =>
  (await api.get('/fines/types')).data

// ---------- Stats ----------
export const getMyStats = async () => (await api.get('/stats/me')).data
export const getUserStats = async (id: number) => (await api.get(`/stats/users/${id}`)).data
export const getLeaderboard = async () => (await api.get('/stats/leaderboard')).data
export const getPeDeMeia = async () => (await api.get('/attendance/pe-de-meia')).data

// ---------- Rankings (página de multas) ----------
export interface RankingRow {
  user_id: number
  name: string
  photo_url: string | null
  pending: number
  count: number
  total: number
}

export interface Rankings {
  top_debtors: RankingRow[]
  top_offenders: RankingRow[]
  top_accumulated: RankingRow[]
  generated_at: string
}

export const getRankings = async (): Promise<Rankings> =>
  (await api.get('/stats/rankings')).data

// ---------- Chat ----------
export interface ChatStreamHandlers {
  onToken?: (token: string) => void
  onError?: (message: string) => void
  onDone?: () => void
}

/**
 * Envia uma mensagem ao assistente e recebe a resposta em streaming (SSE).
 *
 * O backend emite eventos `data: {"token": "..."}`, podendo terminar com
 * `data: {"error": "..."}` e/ou `data: {"done": true}`.
 */
export const streamChatMessage = async (
  message: string,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> => {
  const token = localStorage.getItem('token')

  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
      signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return
    handlers.onError?.('Não foi possível contactar o assistente.')
    return
  }

  // Mesmo comportamento do interceptor axios em caso de sessão expirada.
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return
  }

  if (!res.ok || !res.body) {
    let detail = 'Erro ao contactar o assistente.'
    try {
      const data = await res.json()
      if (data?.detail) detail = data.detail
    } catch {
      /* resposta sem corpo JSON */
    }
    handlers.onError?.(detail)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      // Normaliza quebras de linha para lidar com SSE emitido em CRLF.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload) continue

        let evt: { token?: string; error?: string; done?: boolean }
        try {
          evt = JSON.parse(payload)
        } catch {
          continue
        }

        if (evt.token) handlers.onToken?.(evt.token)
        else if (evt.error) handlers.onError?.(evt.error)
        else if (evt.done) handlers.onDone?.()
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      handlers.onError?.('Erro durante o streaming da resposta.')
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }
}

// ---------- Attendance ----------
export const getAttendanceDay = async (date: string) =>
  (await api.get(`/attendance/day?date_str=${date}`)).data
export const getAttendanceDayCount = async (date: string) =>
  (await api.get(`/attendance/day/count?date_str=${date}`)).data
export const deleteAttendanceDay = async (date: string) =>
  (await api.delete(`/attendance/day?date_str=${date}`)).data
export const getAttendanceSummary = async (year: number) =>
  (await api.get(`/attendance/summary?year=${year}`)).data
export const getAttendanceUserStats = async (userId: number, year?: number) =>
  (await api.get(`/attendance/user/${userId}/stats${year ? `?year=${year}` : ''}`)).data
export const getAttendanceLeaderboard = async (year?: number) =>
  (await api.get(`/attendance/leaderboard${year ? `?year=${year}` : ''}`)).data
export const markAttendance = async (
  date: string,
  records: { user_id: number; status: string; minutes_late?: number | null }[],
) => (await api.post('/attendance/mark', { date, records })).data

// ---------- Notifications ----------
export const getNotifications = async (unreadOnly = false) =>
  (await api.get(`/notifications?unread_only=${unreadOnly}`)).data
export const getUnreadCount = async () =>
  (await api.get('/notifications/unread-count')).data
export const markNotificationRead = async (id: number) =>
  (await api.post(`/notifications/${id}/read`)).data
export const markAllNotificationsRead = async () =>
  (await api.post('/notifications/read-all')).data
/** Gera lembretes de prazo/atraso das multas pendentes (lazy scheduler). */
export const generateReminders = async () =>
  (await api.post('/notifications/generate-reminders')).data

// ---------- Users ----------
export const listUsers = async () => (await api.get('/users')).data
export const getUserDataCount = async (id: number) =>
  (await api.get(`/users/${id}/data-count`)).data
export const deleteUser = async (id: number) => (await api.delete(`/users/${id}`)).data
export const bulkDeleteUsers = async (ids: number[]) =>
  (await api.post('/users/bulk-delete', { ids })).data

export interface UpdateMePayload {
  username?: string
  phone?: string | null
  current_password?: string
  new_password?: string
}

/** O próprio user altera username / telemóvel / palavra-passe (nome é fixo). */
export const updateMe = async (payload: UpdateMePayload) =>
  (await api.patch('/auth/me', payload)).data as {
    user: { id: number; username: string; name: string; phone: string | null; role: string }
    updated: string[]
  }
// Aliases retro-compatíveis (usados pelos modais de multas)
export const getUsers = listUsers
export const setUserRole = async (id: number, role: string) =>
  (await api.patch(`/users/${id}/role`, { role })).data