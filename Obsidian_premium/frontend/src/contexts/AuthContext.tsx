import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getToken, setToken, removeToken } from '@/api/authFetch'

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check whether a valid token already exists in localStorage
    const token = getToken()
    setIsAuthenticated(!!token)
    setIsLoading(false)
  }, [])

  async function login(username: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || 'Erro ao fazer login')
    }

    const data = await res.json() as { token: string }
    setToken(data.token)
    setIsAuthenticated(true)
  }

  function logout(): void {
    removeToken()
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
