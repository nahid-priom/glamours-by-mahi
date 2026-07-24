import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { brandConfig } from '@/config/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PWAInstallButton } from '@/features/pwa/components/PWAInstallButton'
import { AuthSessionProvider, useAuth } from '@/features/auth/auth-session'
import { FullPageLoader } from '@/components/loading/FullPageLoader'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormValues = z.infer<typeof schema>

function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, session, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'mahi@codebondhu.com', password: '' },
  })

  useEffect(() => {
    if (!loading && session) {
      navigate(from, { replace: true })
    }
  }, [loading, session, navigate, from])

  if (loading) return <FullPageLoader label="Checking session…" />

  if (session) return <FullPageLoader label="Redirecting…" />

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await signIn(values.email, values.password)
      navigate(from, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    }
  })

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#F8F6F2] px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#111111]/8 bg-white shadow-sm">
        <div className="bg-[#111111] px-6 py-8 text-white">
          <div className="inline-flex rounded-2xl bg-[#E11D48] p-2.5">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-serif text-3xl">{brandConfig.name}</h1>
          <p className="mt-2 text-sm text-white/70">Retail ERP · Secure staff login</p>
          <p className="mt-1 text-xs text-white/50">{brandConfig.primaryLocation}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-6" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="text-xs text-[#E11D48]">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-[#E11D48]">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          {error ? <p className="text-xs text-[#E11D48]">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" className="rounded-full" type="button" asChild>
              <Link to="/">Visit Storefront</Link>
            </Button>
            <PWAInstallButton variant="menu" />
          </div>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
            Apply <code className="rounded bg-slate-100 px-1">supabase/migrations</code> and create
            staff users in Supabase Auth with matching <code className="rounded bg-slate-100 px-1">profiles</code> rows.
          </p>
        </form>
      </div>
    </div>
  )
}

export function AdminLoginPage() {
  return (
    <AuthSessionProvider>
      <LoginForm />
    </AuthSessionProvider>
  )
}
