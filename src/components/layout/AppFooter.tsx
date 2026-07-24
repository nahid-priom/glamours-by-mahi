import { brandConfig } from '@/config/brand'
import { PoweredByCodeBondhu } from '@/components/brand/PoweredByCodeBondhu'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export function AppFooter({ className }: Props) {
  return (
    <footer
      className={cn(
        'no-print border-t border-border bg-white/80 px-4 py-3 backdrop-blur-sm lg:px-5',
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1366px] flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-center text-xs text-[#6B7280] sm:text-left">
          © {new Date().getFullYear()}{' '}
          <span className="brand-gradient-text font-semibold">{brandConfig.name}</span>
        </p>
        <PoweredByCodeBondhu align="center" className="sm:text-right" />
      </div>
    </footer>
  )
}
