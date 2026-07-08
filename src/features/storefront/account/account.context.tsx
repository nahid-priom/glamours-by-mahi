import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AccountSession } from './account.types'
import { clearSession, getSession, loginByPhone, saveSession } from './account.service'

interface AccountContextValue {
  session: AccountSession | null
  isLoading: boolean
  login: (phone: string) => Promise<AccountSession>
  logout: () => void
  updateSession: (session: AccountSession) => void
  refresh: () => void
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(() => getSession())
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(() => {
    setSession(getSession())
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes('account_session')) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const login = useCallback(async (phone: string) => {
    setIsLoading(true)
    try {
      const next = await loginByPhone(phone)
      setSession(next)
      return next
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const updateSession = useCallback((next: AccountSession) => {
    saveSession(next)
    setSession(next)
  }, [])

  const value = useMemo(
    () => ({ session, isLoading, login, logout, updateSession, refresh }),
    [session, isLoading, login, logout, updateSession, refresh],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
