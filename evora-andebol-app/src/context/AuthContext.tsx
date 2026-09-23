import { createContext, useContext, useEffect, useState } from 'react'
import { login as apiLogin, register as apiRegister } from '../lib/api'

export type Role = 'admin' | 'sindicato' | 'equipa_tecnica' | 'jogador'

export interface User {
  id: number
  username: string
  name: string
  phone?: string | null
  role: Role
  position?: string | null
  photo_url?: string | null
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (
    name: string,
    username: string,
    password: string,
    phone?: string,
  ) => Promise<void>
  updateUser: (user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    if (stored && token) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      }
    }
    setLoading(false)
  }, [])

  const login = async (identifier: string, password: string) => {
    const data = await apiLogin(identifier, password)
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const register = async (
    name: string,
    username: string,
    password: string,
    phone?: string,
  ) => {
    const data = await apiRegister(name, username, password, phone)
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const updateUser = (updated: User) => {
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth tem de estar dentro de AuthProvider')
  return ctx
}