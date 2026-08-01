import { vi } from 'vitest'

type ThenableQuery = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: ReturnType<typeof vi.fn>
}

export function createMockQuery(result: { data?: unknown; error?: unknown; count?: number | null } = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  }

  const query: ThenableQuery = {} as ThenableQuery
  const chain = () => query

  query.select = vi.fn(chain)
  query.insert = vi.fn(chain)
  query.update = vi.fn(chain)
  query.delete = vi.fn(chain)
  query.upsert = vi.fn(chain)
  query.eq = vi.fn(chain)
  query.in = vi.fn(chain)
  query.is = vi.fn(chain)
  query.order = vi.fn(chain)
  query.limit = vi.fn(chain)
  query.range = vi.fn(chain)
  query.maybeSingle = vi.fn(async () => resolved)
  query.single = vi.fn(async () => resolved)
  query.then = vi.fn((resolve: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve)) as never

  return query
}

export function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn(() => createMockQuery()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: null, error: null })),
        remove: vi.fn(async () => ({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      })),
    },
    ...overrides,
  }
}
