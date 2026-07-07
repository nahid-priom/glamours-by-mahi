import { useState } from 'react'
import { Bell, Calendar, Maximize2, Minimize2, Search } from 'lucide-react'
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
import { ROLES } from '@/lib/constants'

interface TopHeaderProps {
  onMenuClick?: () => void
}

export function TopHeader({ onMenuClick: _onMenuClick }: TopHeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [role, setRole] = useState<string>('Super Admin')

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold sm:text-2xl">
            {greeting}, CEO 👋
          </h2>
          <p className="truncate text-xs text-text-muted sm:text-sm">
            Here&apos;s what&apos;s happening with SMART ORDER MS today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-xl border border-border bg-slate-50 px-3 py-1.5 text-xs text-text-muted lg:flex">
            <Calendar className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">{formatDate()}</span>
          </div>

          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Search className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="hidden sm:flex">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>CEO</AvatarFallback>
                </Avatar>
                <span className="hidden text-xs font-medium sm:inline">{role}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ROLES.map((r) => (
                <DropdownMenuItem key={r} onClick={() => setRole(r)}>
                  {r}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
