import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAccount } from './account.context'
import { profileCompletion, syncProfile } from './account.service'

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(11, 'Valid phone required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  district: z.string().min(2, 'District is required'),
  address: z.string().min(5, 'Address is required'),
})

type ProfileForm = z.infer<typeof profileSchema>

export function AccountProfilePage() {
  const { session, updateSession } = useAccount()
  const { toast } = useToast()

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: session?.name ?? '',
      phone: session?.phone ?? '',
      email: session?.email ?? '',
      district: session?.district ?? '',
      address: session?.address ?? '',
    },
  })

  useEffect(() => {
    if (!session) return
    form.reset({
      name: session.name ?? '',
      phone: session.phone ?? '',
      email: session.email ?? '',
      district: session.district ?? '',
      address: session.address ?? '',
    })
  }, [session, form])

  const completion = useMemo(() => profileCompletion(session), [session])

  const onSubmit = async (data: ProfileForm) => {
    try {
      const next = {
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        district: data.district,
        address: data.address,
      }
      await syncProfile(next)
      updateSession(next)
      toast('Profile saved successfully')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save profile', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#111111]/8 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-2xl text-[#111111]">Profile</h2>
        <p className="mt-1 text-sm text-[#6B7280]">Keep your contact and delivery details up to date</p>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.15em] text-[#6B7280]">
            <span>Profile completion</span>
            <span className="text-[#111111]">{completion}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F8F6F2]">
            <div
              className="h-full rounded-full bg-[#E11D48] transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 rounded-3xl border border-[#111111]/8 bg-white p-5 shadow-sm sm:p-6"
      >
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" {...form.register('name')} className="mt-1.5 rounded-xl" />
          {form.formState.errors.name && (
            <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...form.register('phone')} className="mt-1.5 rounded-xl" />
          {form.formState.errors.phone && (
            <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.phone.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register('email')} className="mt-1.5 rounded-xl" />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="district">District</Label>
          <Input id="district" {...form.register('district')} className="mt-1.5 rounded-xl" />
          {form.formState.errors.district && (
            <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.district.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address">Full Address</Label>
          <Input id="address" {...form.register('address')} className="mt-1.5 rounded-xl" />
          {form.formState.errors.address && (
            <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.address.message}</p>
          )}
        </div>

        <Button type="submit" className="rounded-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </div>
  )
}
