import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useCart } from './cart.context'
import { checkoutService } from './checkout.service'
import { CheckoutSummary } from './components/CheckoutSummary'
import { getDefaultAddress, getSession, saveSession, syncProfile } from './account/account.service'
import type { AccountSession } from './account/account.types'

const checkoutSchema = z.object({
  customer_name: z.string().min(2, 'Name is required'),
  phone: z.string().min(11, 'Valid phone required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().min(10, 'Full address required'),
  district: z.string().min(2, 'District required'),
  delivery_area: z.string().min(2, 'Delivery area required'),
  notes: z.string().optional(),
})

type CheckoutForm = z.infer<typeof checkoutSchema>

export function CheckoutPage() {
  const navigate = useNavigate()
  const { items, subtotal, deliveryCharge, total, itemCount } = useCart()
  const { toast } = useToast()

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customer_name: '',
      phone: '',
      email: '',
      address: '',
      district: '',
      delivery_area: '',
      notes: '',
    },
  })

  useEffect(() => {
    const session = getSession()
    const defaultAddr = session ? getDefaultAddress(session.phone) : null
    if (!session && !defaultAddr) return

    form.reset({
      customer_name: defaultAddr?.fullName || session?.name || '',
      phone: session?.phone || defaultAddr?.phone || '',
      email: session?.email || '',
      address: defaultAddr?.address || session?.address || '',
      district: defaultAddr?.district || session?.district || '',
      delivery_area: defaultAddr?.area || session?.delivery_area || '',
      notes: '',
    })
  }, [form])

  const mutation = useMutation({
    mutationFn: checkoutService.placeOrder,
    onSuccess: async (result, variables) => {
      const session: AccountSession = {
        phone: variables.phone,
        name: variables.customer_name,
        email: variables.email,
        address: variables.address,
        district: variables.district,
        delivery_area: variables.delivery_area,
      }
      saveSession(session)
      try {
        await syncProfile(session)
      } catch {
        /* profile sync is best-effort */
      }
      try {
        const { erpOrdersService } = await import('@/services/erp-orders.service')
        erpOrdersService.createFromWebsite({
          customerName: variables.customer_name,
          phone: variables.phone,
          email: variables.email,
          address: variables.address,
          district: variables.district,
          deliveryCharge,
          note: variables.notes,
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            unitPrice: i.price,
          })),
        })
      } catch {
        /* ERP sync best-effort for demo continuity */
      }
      navigate(`/order-success/${result.primaryOrderId}`)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <p className="text-[#6B7280]">Your cart is empty</p>
        <Link to="/shop"><Button className="mt-4 rounded-full">Shop Now</Button></Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl text-[#111111]">Checkout</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Cash on Delivery · Fraud check applied automatically</p>

      <form
        onSubmit={form.handleSubmit((data) =>
          mutation.mutate({
            ...data,
            email: data.email || undefined,
          }),
        )}
        className="mt-8 grid gap-8 lg:grid-cols-5"
      >
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-3xl border border-[#111111]/8 bg-white p-5 shadow-sm">
            <h2 className="font-medium text-[#111111]">Delivery Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="customer_name">Full Name *</Label>
                <Input id="customer_name" {...form.register('customer_name')} className="mt-1 rounded-xl" />
                {form.formState.errors.customer_name && (
                  <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.customer_name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" {...form.register('phone')} placeholder="01XXXXXXXXX" className="mt-1 rounded-xl" />
                {form.formState.errors.phone && (
                  <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" type="email" {...form.register('email')} className="mt-1 rounded-xl" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Full Address *</Label>
                <Input id="address" {...form.register('address')} className="mt-1 rounded-xl" />
                {form.formState.errors.address && (
                  <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.address.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="district">District *</Label>
                <Input id="district" {...form.register('district')} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="delivery_area">Delivery Area *</Label>
                <Input id="delivery_area" {...form.register('delivery_area')} placeholder="e.g. Gulshan Zone" className="mt-1 rounded-xl" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Order Notes</Label>
                <Input id="notes" {...form.register('notes')} placeholder="Special instructions..." className="mt-1 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <CheckoutSummary subtotal={subtotal} deliveryCharge={deliveryCharge} total={total} itemCount={itemCount} />
          <Button type="submit" className="mt-4 w-full rounded-full" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? 'Placing Order...' : 'Place COD Order'}
          </Button>
        </div>
      </form>
    </div>
  )
}
