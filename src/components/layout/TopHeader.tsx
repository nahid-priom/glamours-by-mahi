import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Calendar, LogOut, Maximize2, Minimize2, Search } from 'lucide-react'
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
import { formatDate } from '@/lib/format'
import { useAuth } from '@/features/auth/auth.context'
import { PWAInstallButton } from '@/features/pwa/components/PWAInstallButton'
import { QuickActionsMenu } from '@/features/dashboard/components/QuickActionsMenu'
import { BranchSwitcher } from '@/components/layout/BranchSwitcher'

export function TopHeader() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { session, profile, signOut, permissions } = useAuth()
  const navigate = useNavigate()

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const name = session?.name ?? profile?.full_name ?? 'Staff'
  const role = session?.role ?? profile?.role_name ?? 'User'
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
    <header className="sticky top-0 z-30 hidden border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:block">
      <div className="flex max-w-full items-center justify-between gap-4 px-4 py-2.5 sm:px-5 sm:py-3">
        {/* Left: workspace context */}
        <div className="flex min-w-0 items-center gap-1.5">
          <BranchSwitcher />
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-50 px-3 py-1.5 text-xs text-text-muted">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[180px] truncate">{formatDate()}</span>
          </div>
        </div>

        {/* Right: actions | tools | user */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center">
            <QuickActionsMenu />
          </div>

          <div className="h-5 w-px bg-border" aria-hidden />

          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
            <PWAInstallButton />
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label="Fullscreen">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-5 w-px bg-border" aria-hidden />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="max-w-[100px] truncate text-xs font-medium">{role}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="min-w-0">
                  <p className="truncate text-sm">{name}</p>
                  <p className="truncate text-[10px] font-normal text-muted-foreground">
                    {permissions.includes('*')
                      ? 'Full access'
                      : `${permissions.length} permissions`}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleSignOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
