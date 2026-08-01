import type { AuthProfile } from '@/features/auth/auth-session'
import type { Permission } from '@/lib/permissions'

export const TEST_ORG_ID = '00000000-0000-4000-8000-000000000010'
export const TEST_BRANCH_ID = '00000000-0000-4000-8000-000000000030'
export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'

export function makeAuthProfile(overrides: Partial<AuthProfile> = {}): AuthProfile {
  return {
    id: TEST_USER_ID,
    organization_id: TEST_ORG_ID,
    full_name: 'Test Admin',
    email: 'admin@test.local',
    phone: null,
    role_id: '00000000-0000-4000-8000-000000000020',
    default_branch_id: TEST_BRANCH_ID,
    is_active: true,
    role_name: 'Super Admin',
    ...overrides,
  }
}

export function makePermissionSet(
  permissions: Array<Permission | string> = ['*'],
): string[] {
  return permissions as string[]
}
