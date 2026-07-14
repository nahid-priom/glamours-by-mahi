import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { brandConfig } from '@/config/brand'
import { authService } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { PWAInstallButton } from '@/features/pwa'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const users = authService.getUsers()

  const enter = (userId: string) => {
    authService.login(userId)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F6F2] px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#111111]/8 bg-white shadow-sm">
        <div className="bg-[#111111] px-6 py-8 text-white">
          <div className="inline-flex rounded-2xl bg-[#E11D48] p-2.5">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-serif text-3xl">{brandConfig.name}</h1>
          <p className="mt-2 text-sm text-white/70">{brandConfig.description}</p>
          <p className="mt-1 text-xs text-white/50">{brandConfig.primaryLocation}</p>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B7280]">Demo Login</p>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => enter(u.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-[#111111]/8 px-4 py-3 text-left transition hover:border-[#E11D48]/40 hover:shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-[#111111]">{u.name}</p>
                <p className="text-xs text-[#6B7280]">{u.role}</p>
              </div>
              <span className="text-xs font-medium text-[#E11D48]">Enter →</span>
            </button>
          ))}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate('/')}>
              Visit Storefront
            </Button>
            <PWAInstallButton variant="menu" />
          </div>
        </div>
      </div>
    </div>
  )
}
