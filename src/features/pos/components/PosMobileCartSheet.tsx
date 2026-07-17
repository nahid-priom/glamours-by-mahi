import type { ReactNode } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'

export type PosMobileCartBarProps = {
  itemCount: number
  total: number
  onOpen: () => void
  className?: string
}

export function PosMobileCartBar({
  itemCount,
  total,
  onOpen,
  className,
}: PosMobileCartBarProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 z-40 px-3 lg:hidden',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
        className,
      )}
    >
      <Button
        type="button"
        className="h-12 w-full rounded-full shadow-lg"
        onClick={onOpen}
        aria-label={`View cart, ${itemCount} items, total ${formatBDT(total)}`}
      >
        <ShoppingCart className="h-4 w-4" />
        View Cart ({itemCount}) · {formatBDT(total)}
      </Button>
    </div>
  )
}

export type PosMobileCartSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function PosMobileCartSheet({
  open,
  onOpenChange,
  children,
}: PosMobileCartSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[min(92dvh,100%)] max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
          <SheetTitle>Cart</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden p-3">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
