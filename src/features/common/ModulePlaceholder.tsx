import { Link } from 'react-router-dom'
import { brandConfig } from '@/config/brand'

interface ModulePlaceholderProps {
  title: string
  description?: string
  permissionHint?: string
}

/** Temporary shell for routes that are wired but whose full UI is landing in later phases. */
export function ModulePlaceholder({
  title,
  description = 'This module is connected to the Supabase schema and permissions. Data views will load from PostgreSQL once seeded.',
  permissionHint,
}: ModulePlaceholderProps) {
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 px-1">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E11D48]">
          {brandConfig.shortName}
        </p>
        <h1 className="mt-2 text-xl font-bold text-[#111827]">{title}</h1>
        <p className="mt-2 text-sm text-[#6B7280]">{description}</p>
        {permissionHint ? (
          <p className="mt-3 text-xs text-[#9CA3AF]">Requires: {permissionHint}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/dashboard"
            className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white"
          >
            Back to Dashboard
          </Link>
          <Link
            to="/sales/pos"
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-[#111827]"
          >
            Open POS
          </Link>
        </div>
      </div>
    </div>
  )
}
