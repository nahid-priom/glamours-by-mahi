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
import { brandConfig } from '@/config/brand'
import { useAuth } from '@/features/auth/auth.context'
import { PWAInstallButton } from '@/features/pwa/components/PWAInstallButton'
import { QuickActionsMenu } from '@/features/dashboard/components/QuickActionsMenu'

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
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
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
    <header className="sticky top-14 z-30 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:top-0">
      <div className="flex max-w-full items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold sm:text-xl">
            {greeting}, {name.split(' ')[0]}
          </h2>
          <p className="truncate text-xs text-text-muted sm:text-sm">
            {brandConfig.name} · {brandConfig.primaryLocation}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <QuickActionsMenu />
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-50 px-3 py-1.5 text-xs text-text-muted">
            <Calendar className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">{formatDate()}</span>
          </div>
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
