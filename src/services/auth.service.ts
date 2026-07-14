import { peekDatabase } from '@/database/transaction'
import type { ErpRole, User } from '@/database/schema'

const SESSION_KEY = 'glamourous_demo_session'

export interface DemoSession {
  userId: string
  role: ErpRole
  name: string
  branchId: string | null
}

export const authService = {
  getUsers(): User[] {
    return peekDatabase().users.filter((u) => u.isActive)
  },

  getSession(): DemoSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as DemoSession) : null
    } catch {
      return null
    }
  },

  login(userId: string): DemoSession {
    const user = this.getUsers().find((u) => u.id === userId)
    if (!user) throw new Error('User not found')
    const session: DemoSession = {
      userId: user.id,
      role: user.role,
      name: user.name,
      branchId: user.branchId,
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  },

  switchRole(userId: string): DemoSession {
    return this.login(userId)
  },

  logout(): void {
    localStorage.removeItem(SESSION_KEY)
  },

  ensureSession(): DemoSession {
    const existing = this.getSession()
    if (existing) return existing
    const owner = this.getUsers().find((u) => u.role === 'Owner') ?? this.getUsers()[0]
    return this.login(owner.id)
  },

  canAccess(role: ErpRole, module: string): boolean {
    if (role === 'Super Admin' || role === 'Owner') return true
    const map: Record<ErpRole, string[]> = {
      'Super Admin': ['*'],
      Owner: ['*'],
      'Branch Admin': ['dashboard', 'sales', 'orders', 'products', 'inventory', 'customers', 'reports', 'courier'],
      'Sales Manager': ['dashboard', 'sales', 'orders', 'customers', 'commission', 'reports'],
      'Accounts User': ['dashboard', 'accounts', 'suppliers', 'purchases', 'customers', 'reports'],
      'HR User': ['dashboard', 'hr', 'payroll', 'attendance'],
      Salesperson: ['dashboard', 'sales', 'customers', 'orders'],
    }
    const allowed = map[role] ?? []
    return allowed.includes('*') || allowed.includes(module)
  },
}
