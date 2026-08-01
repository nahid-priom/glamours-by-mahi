import { useAuth } from '@/features/auth/auth-session'
import { BranchSwitcher } from '@/components/layout/BranchSwitcher'

export function StaffProfilePage() {
  const { profile, activeBranchId, branchIds } = useAuth()

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-sm text-[#6B7280]">আপনার অ্যাকাউন্ট তথ্য</p>
      </div>
      <dl className="space-y-3 rounded-2xl border bg-white p-4 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6B7280]">Name</dt>
          <dd className="font-medium">{profile?.full_name}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6B7280]">Role</dt>
          <dd className="font-medium">{profile?.role_name ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6B7280]">Email</dt>
          <dd className="font-medium">{profile?.email ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6B7280]">Phone</dt>
          <dd className="font-medium">{profile?.phone ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6B7280]">Active branch</dt>
          <dd className="font-medium font-mono text-xs">{activeBranchId ?? '—'}</dd>
        </div>
      </dl>
      {branchIds.length > 1 ? (
        <div className="rounded-2xl border bg-white p-4">
          <p className="mb-2 text-sm font-semibold">Branch switch</p>
          <BranchSwitcher allowAll={false} size="md" />
        </div>
      ) : null}
    </div>
  )
}
