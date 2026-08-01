import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { hasPermission, type Permission } from '@/lib/permissions'

export interface AuthProfile {
  id: string
  organization_id: string
  full_name: string
  email: string | null
  phone: string | null
  role_id: string | null
  default_branch_id: string | null
  is_active: boolean
  role_name: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  permissions: string[]
  branchIds: string[]
  activeBranchId: string | null
  setActiveBranchId: (id: string | null) => void
  loading: boolean
  can: (permission: Permission | Permission[]) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const BRANCH_KEY = 'glamourous_active_branch'

async function loadProfileBundle(userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'id, organization_id, full_name, email, phone, role_id, default_branch_id, is_active',
    )
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!profile) {
    return { profile: null as AuthProfile | null, permissions: [] as string[], branchIds: [] as string[] }
  }

  let roleName: string | null = null
  let permissions: string[] = []

  if (profile.role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', profile.role_id)
      .is('deleted_at', null)
      .maybeSingle()
    roleName = role?.name ?? null

    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', profile.role_id)
      .is('deleted_at', null)

    const permissionIds = rolePerms?.map((rp) => rp.permission_id).filter(Boolean) ?? []
    if (permissionIds.length) {
      const { data: perms } = await supabase.from('permissions').select('key').in('id', permissionIds)
      permissions = perms?.map((p) => p.key).filter(Boolean) ?? []
    }

    if (roleName === 'Super Admin' || roleName === 'Owner') {
      permissions = ['*', ...permissions]
    }
  }

  const { data: branchAccess } = await supabase
    .from('user_branch_access')
    .select('branch_id')
    .eq('user_id', userId)
    .is('deleted_at', null)

  const branchIds = branchAccess?.map((b) => b.branch_id) ?? []

  const authProfile: AuthProfile = {
    id: profile.id,
    organization_id: profile.organization_id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role_id: profile.role_id,
    default_branch_id: profile.default_branch_id,
    is_active: profile.is_active,
    role_name: roleName,
  }

  return { profile: authProfile, permissions, branchIds }
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(BRANCH_KEY)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const applyUser = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null)
      setPermissions([])
      setBranchIds([])
      return
    }
    const bundle = await loadProfileBundle(user.id)
    setProfile(bundle.profile)
    setPermissions(bundle.permissions)
    setBranchIds(bundle.branchIds)
    if (bundle.profile?.default_branch_id && !localStorage.getItem(BRANCH_KEY)) {
      setActiveBranchIdState(bundle.profile.default_branch_id)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    await applyUser(data.user ?? null)
  }, [applyUser])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      try {
        await applyUser(data.session?.user ?? null)
      } finally {
        if (mounted) setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void applyUser(next?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [applyUser])

  const setActiveBranchId = useCallback((id: string | null) => {
    setActiveBranchIdState(id)
    try {
      if (id) localStorage.setItem(BRANCH_KEY, id)
      else localStorage.removeItem(BRANCH_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const can = useCallback(
    (permission: Permission | Permission[]) => hasPermission(permissions, permission),
    [permissions],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setPermissions([])
    setBranchIds([])
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      permissions,
      branchIds,
      activeBranchId: activeBranchId ?? profile?.default_branch_id ?? null,
      setActiveBranchId,
      loading,
      can,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      permissions,
      branchIds,
      activeBranchId,
      setActiveBranchId,
      loading,
      can,
      signIn,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthSessionProvider')
  return ctx
}

/** Test-only provider: inject auth state without Supabase session bootstrap. */
export function AuthTestProvider({
  value,
  children,
}: {
  value: Partial<AuthContextValue>
  children: ReactNode
}) {
  const merged = useMemo<AuthContextValue>(
    () => ({
      session: null,
      user: null,
      profile: null,
      permissions: [],
      branchIds: [],
      activeBranchId: null,
      setActiveBranchId: () => undefined,
      loading: false,
      signIn: async () => undefined,
      signOut: async () => undefined,
      refreshProfile: async () => undefined,
      ...value,
      can:
        value.can ??
        ((permission) => hasPermission(value.permissions ?? [], permission)),
    }),
    [value],
  )
  return <AuthContext.Provider value={merged}>{children}</AuthContext.Provider>
}
