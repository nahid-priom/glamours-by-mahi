import { brandConfig } from '@/config/brand'

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh w-full max-w-full flex-col items-center justify-center gap-3 bg-[#FAFAF9] px-4">
      <div className="h-10 w-10 animate-pulse rounded-xl bg-[#E11D48]" />
      <p className="text-sm font-semibold text-[#111827]">{brandConfig.shortName}</p>
      <p className="text-xs text-[#6B7280]">{label}</p>
    </div>
  )
}
