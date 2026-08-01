import { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import {
  AuthTestProvider,
  type AuthProfile,
} from '@/features/auth/auth-session'
import type { Permission } from '@/lib/permissions'

export type RenderWithAppProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  route?: string
  routerProps?: MemoryRouterProps
  permissions?: Array<Permission | string>
  profile?: Partial<AuthProfile> | null
  activeBranchId?: string | null
  branchIds?: string[]
  loading?: boolean
  queryClient?: QueryClient
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithAppProviders(
  ui: ReactElement,
  options: RenderWithAppProvidersOptions = {},
) {
  const {
    route = '/',
    routerProps,
    permissions = ['*'],
    profile = {
      id: '00000000-0000-4000-8000-000000000001',
      organization_id: '00000000-0000-4000-8000-000000000010',
      full_name: 'Test Admin',
      email: 'admin@test.local',
      phone: null,
      role_id: '00000000-0000-4000-8000-000000000020',
      default_branch_id: '00000000-0000-4000-8000-000000000030',
      is_active: true,
      role_name: 'Super Admin',
    },
    activeBranchId = '00000000-0000-4000-8000-000000000030',
    branchIds = ['00000000-0000-4000-8000-000000000030'],
    loading = false,
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthTestProvider
          value={{
            permissions: permissions as string[],
            profile: profile as AuthProfile | null,
            activeBranchId,
            branchIds,
            loading,
          }}
        >
          <MemoryRouter initialEntries={[route]} {...routerProps}>
            {children}
          </MemoryRouter>
        </AuthTestProvider>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}
