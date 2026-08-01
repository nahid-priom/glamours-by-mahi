import { Bell, LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { APP_NAME } from '@/lib/constants'
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
import { BranchSwitcher } from '@/components/layout/BranchSwitcher'
import { useAuth } from '@/features/auth/auth-session'
import { cn } from '@/lib/utils'

interface MobileTopBarProps {
  onMenuClick: () => void
  className?: string
}

export function MobileTopBar({ onMenuClick, className }: MobileTopBarProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const name = profile?.full_name ?? 'Staff'
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-white px-3 lg:hidden',
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

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-red-500">{APP_NAME}</p>
        <BranchSwitcher className="mt-0.5 max-w-full border-0 bg-transparent px-0 py-0" />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-50"
              aria-label="Profile menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <p className="truncate text-sm">{name}</p>
              <p className="truncate text-[10px] font-normal text-muted-foreground">
                {profile?.role_name ?? 'Staff'}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleSignOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
