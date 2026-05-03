import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { api } from '../lib/api'
import { storage } from '../lib/storage'
import type { AuthResponse, User } from '../types/auth'

interface LoginForm {
  username: string
  password: string
}

interface AuthContextValue {
  isAuthenticated: boolean
  user: User | null
  isBusy: boolean
  login: (form: LoginForm) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    const storedUser = storage.getUser<User>()
    if (storedUser) {
      startTransition(() => setUser(storedUser))
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(user && storage.getToken()),
      user,
      isBusy,
      async login(form) {
        setIsBusy(true)
        try {
          const { data } = await api.post<AuthResponse>('/auth/login', form)
          storage.setToken(data.token)
          storage.setUser(data.user)
          setUser(data.user)
        } finally {
          setIsBusy(false)
        }
      },
      logout() {
        storage.clearToken()
        storage.clearUser()
        setUser(null)
      },
    }),
    [isBusy, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }

  return context
}
