import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        success: 'bg-green-50 text-green-700 ring-1 ring-green-200',
        warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
        blocked: 'bg-red-900 text-white',
        info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
        purple: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
