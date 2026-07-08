import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAccount } from './account.context'

export function GuestAccountPanel() {
  const { login, isLoading } = useAccount()
  const { toast } = useToast()
  const [phone, setPhone] = useState('')

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.trim().length < 11) {
      toast('Enter a valid phone number', 'error')
      return
    }
    try {
      await login(phone.trim())
      toast('Welcome back!')
    } catch {
      toast('Could not load account', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="overflow-hidden rounded-3xl border border-[#111111]/8 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#111111] to-[#2a2a2a] px-6 py-8 text-white sm:px-8">
          <div className="inline-flex rounded-2xl bg-white/10 p-2.5">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-serif text-3xl">Find Your Account</h1>
          <p className="mt-2 text-sm text-white/70">
            Enter your phone number to view orders, wishlist, and saved details.
          </p>
        </div>

        <form onSubmit={handleContinue} className="space-y-4 p-6 sm:p-8">
          <div>
            <label htmlFor="guest-phone" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
              Phone Number
            </label>
            <div className="relative mt-2">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <Input
                id="guest-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="rounded-full pl-10"
              />
            </div>
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Continue'}
          </Button>

          <Link
            to="/track-order"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#111111]/10 py-3 text-sm font-medium text-[#111111] transition hover:border-[#111111]/25"
          >
            <Search className="h-4 w-4" />
            Track Order
          </Link>
        </form>
      </div>
    </div>
  )
}
