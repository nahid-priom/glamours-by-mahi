import type { AuthProfile } from '@/features/auth/auth-session'

let seq = 0

export function buildAuthProfile(overrides: Partial<AuthProfile> = {}): AuthProfile {
  seq += 1
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    organization_id: '00000000-0000-4000-8000-000000000010',
    full_name: `User ${seq}`,
    email: `user${seq}@test.local`,
    phone: null,
    role_id: '00000000-0000-4000-8000-000000000020',
    default_branch_id: '00000000-0000-4000-8000-000000000030',
    is_active: true,
    role_name: 'Staff',
    ...overrides,
  }
}
