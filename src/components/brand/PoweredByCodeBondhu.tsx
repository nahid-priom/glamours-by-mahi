import { cn } from '@/lib/utils'
import { brandConfig } from '@/config/brand'

type Props = {
  className?: string
  align?: 'left' | 'center' | 'right'
  size?: 'xs' | 'sm'
  prefixClassName?: string
}

export function PoweredByCodeBondhu({
  className,
  align = 'center',
  size = 'sm',
  prefixClassName,
}: Props) {
  const alignClass =
    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
  const sizeClass = size === 'xs' ? 'text-[10px]' : 'text-xs'

  return (
    <p className={cn(alignClass, sizeClass, 'text-[#9CA3AF]', className)}>
      <span className={cn('text-inherit', prefixClassName)}>Powered by </span>
      <span className="brand-gradient-text font-semibold">{brandConfig.poweredBy}</span>
    </p>
  )
}
