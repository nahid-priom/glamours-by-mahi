import { useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { ROLES } from '@/lib/constants'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface MobileTopBarProps {
  onMenuClick: () => void
  className?: string
}

export function MobileTopBar({ onMenuClick, className }: MobileTopBarProps) {
  const [role, setRole] = useState<string>('Super Admin')

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-border bg-white px-4 lg:hidden',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1 px-2 text-center">
        <span className="truncate text-sm font-bold text-red-500">{APP_NAME}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-50"
              aria-label="Profile menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px] font-semibold">CEO</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{role}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-text-muted">
              Switch Role
            </DropdownMenuLabel>
            {ROLES.map((r) => (
              <DropdownMenuItem key={r} onClick={() => setRole(r)}>
                {r}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
