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
import { hasUnresolvedCartItems } from './utils/product-variants'
import { CheckoutSummary } from './components/CheckoutSummary'
import { getDefaultAddress, getSession, saveSession, syncProfile } from './account/account.service'
import type { AccountSession } from './account/account.types'
import { toastRpcError } from '@/lib/errors/rpc-error'

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
      sessionStorage.setItem(
        `order-success:${result.primaryOrderId}`,
        JSON.stringify({
          invoiceNo: result.invoiceNo,
          totalCod: result.totalCod,
          deliveryCharge: result.deliveryCharge,
          publicShareToken: result.publicShareToken,
          customerName: variables.customer_name,
          phone: variables.phone,
        }),
      )
      navigate(`/order-success/${result.primaryOrderId}`)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  if (items.length === 0) {
    return (
      <div className="sf-container max-w-[1440px] py-16 text-center">
        <p className="text-[var(--sf-muted)]">Your cart is empty</p>
        <Link to="/shop">
          <Button className="mt-4 rounded-full bg-[var(--sf-primary)] hover:bg-[var(--sf-primary-hover)]">
            Shop Now
          </Button>
        </Link>
      </div>
    )
  }

  if (hasUnresolvedCartItems(items)) {
    return (
      <div className="sf-container max-w-[1440px] py-16 text-center">
        <h1 className="font-serif text-2xl text-[var(--sf-ink)]">Almost there</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--sf-muted)]">
          Please choose the options for the highlighted items in your cart before checkout.
        </p>
        <Link to="/cart">
          <Button className="mt-6 rounded-full bg-[var(--sf-primary)] hover:bg-[var(--sf-primary-hover)]">
            Review Cart
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="sf-container max-w-[1440px] py-8">
      <h1 className="font-serif text-3xl text-[var(--sf-ink)]">Checkout</h1>
      <p className="mt-1 text-sm text-[var(--sf-muted)]">
        Cash on Delivery · Secure & distraction-free
      </p>

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
          <div className="rounded-3xl border border-[var(--sf-border)] bg-white p-5 shadow-sm">
            <h2 className="font-medium text-[var(--sf-ink)]">Delivery Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="customer_name">Full Name *</Label>
                <Input id="customer_name" {...form.register('customer_name')} className="mt-1 rounded-xl" />
                {form.formState.errors.customer_name && (
                  <p className="mt-1 text-xs text-[#FF3F7F]">{form.formState.errors.customer_name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" {...form.register('phone')} placeholder="01XXXXXXXXX" className="mt-1 rounded-xl" />
                {form.formState.errors.phone && (
                  <p className="mt-1 text-xs text-[#FF3F7F]">{form.formState.errors.phone.message}</p>
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
                  <p className="mt-1 text-xs text-[#FF3F7F]">{form.formState.errors.address.message}</p>
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
          <Button
            type="submit"
            className="mt-4 w-full rounded-full bg-[var(--sf-primary)] hover:bg-[var(--sf-primary-hover)]"
            size="lg"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Placing Order...' : 'Place COD Order'}
          </Button>
        </div>
      </form>
    </div>
  )
}
