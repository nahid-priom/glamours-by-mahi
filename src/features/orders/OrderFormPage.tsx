import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FraudRiskBadge } from '@/features/fraud/FraudRiskBadge'
import { fraudService } from '@/features/fraud/fraud.service'
import { customersService } from '@/features/customers/customers.service'
import { ordersService } from '@/features/orders/orders.service'
import { ProductPicker, type ProductSelection } from '@/features/orders/components/ProductPicker'
import { MOCK_COURIERS, MOCK_STORES } from '@/lib/mock-data'
import { formatBDT } from '@/lib/format'
import { useToast } from '@/components/ui/toast'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

const orderSchema = z.object({
  store_id: z.string().min(1, 'Store is required'),
  customer_name: z.string().min(2, 'Name is required'),
  phone: z.string().min(11, 'Valid phone required'),
  address: z.string().min(5, 'Address is required'),
  quantity: z.number().int().positive(),
  cod_amount: z.number().positive(),
  courier_id: z.string().optional(),
  delivery_area: z.string().optional(),
  customer_note: z.string().optional(),
  order_note: z.string().optional(),
})

type OrderFormValues = z.infer<typeof orderSchema>

export function OrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { toast } = useToast()
  const [product, setProduct] = useState<ProductSelection | null>(null)

  const { data: existingOrder, isLoading: loadingOrder } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => ordersService.getOrderById(id!),
    enabled: isEdit,
  })

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      store_id: '',
      customer_name: '',
      phone: '',
      address: '',
      quantity: 1,
      cod_amount: 0,
      courier_id: '',
      delivery_area: '',
      customer_note: '',
      order_note: '',
    },
  })

  useEffect(() => {
    if (existingOrder) {
      form.reset({
        store_id: existingOrder.store_id,
        customer_name: existingOrder.customer_name,
        phone: existingOrder.customer_phone,
        address: existingOrder.delivery_address ?? existingOrder.customer_address ?? '',
        quantity: existingOrder.quantity,
        cod_amount: existingOrder.cod_amount,
        courier_id: existingOrder.courier_id ?? '',
        delivery_area: existingOrder.delivery_area ?? '',
        customer_note: existingOrder.customer_note ?? '',
        order_note: existingOrder.order_note ?? existingOrder.order_task_note ?? '',
      })
      setProduct({
        product_id: existingOrder.product_id,
        product_name: existingOrder.product_name,
        sku: existingOrder.sku,
        unit_price: existingOrder.unit_price ?? existingOrder.cod_amount / existingOrder.quantity,
        is_custom: !existingOrder.product_id,
      })
    }
  }, [existingOrder, form])

  const storeId = form.watch('store_id')
  const phone = form.watch('phone')
  const quantity = form.watch('quantity')
  const codAmount = form.watch('cod_amount')

  const { data: customer } = useQuery({
    queryKey: ['customer', phone],
    queryFn: () => customersService.getCustomerByPhone(phone),
    enabled: phone.length >= 11,
  })

  useEffect(() => {
    if (product?.unit_price) {
      form.setValue('cod_amount', product.unit_price * quantity)
    }
  }, [product, quantity, form])

  const { data: fraudResult, isFetching: fraudLoading } = useQuery({
    queryKey: ['fraud', 'hybrid', phone, codAmount],
    queryFn: () => fraudService.runHybridCheck(phone, { cod_amount: codAmount }),
    enabled: phone.length >= 11,
  })

  const fraudRisk = fraudResult ?? {
    risk_level: 'SAFE' as const,
    final_score: 15,
    reasons: ['Enter phone to run fraud check'],
    needs_call_confirmation: false,
    recommended_action: 'Normal delivery',
  }

  const createMutation = useMutation({
    mutationFn: ordersService.createOrder,
    onSuccess: () => {
      toast('Order created successfully')
      navigate('/orders')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof ordersService.updateOrder>[1]) =>
      ordersService.updateOrder(id!, data),
    onSuccess: () => {
      toast('Order updated successfully')
      navigate('/orders')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const onSubmit = (data: OrderFormValues) => {
    if (!product?.product_name) {
      toast('Please select or enter a product', 'error')
      return
    }
    if (fraudRisk.risk_level === 'BLOCKED' && !isEdit) {
      toast('Cannot create order — customer is blocked due to fraud risk', 'error')
      return
    }

    const payload = {
      store_id: data.store_id,
      customer_id: customer?.id,
      customer_name: data.customer_name,
      customer_phone: data.phone,
      delivery_address: data.address,
      product_id: product.product_id,
      product_name: product.product_name,
      sku: product.sku,
      quantity: data.quantity,
      unit_price: product.unit_price,
      cod_amount: data.cod_amount,
      courier_id: data.courier_id || undefined,
      courier_name: MOCK_COURIERS.find((c) => c.id === data.courier_id)?.name,
      delivery_area: data.delivery_area,
      customer_note: data.customer_note,
      order_note: data.order_note,
      fraud_level: fraudRisk.risk_level,
      fraud_score: fraudRisk.final_score,
    }

    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  if (isEdit && loadingOrder) return <LoadingSkeleton rows={6} />

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/orders">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Order' : 'New Order'}</h1>
          <p className="mt-1 text-sm text-text-muted">Manual order entry with fraud check</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={storeId} onValueChange={(v) => form.setValue('store_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {MOCK_STORES.filter((s) => s.status === 'active').map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Customer Name</Label>
              <Input {...form.register('customer_name')} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...form.register('phone')} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Delivery Address</Label>
              <Input {...form.register('address')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Product</Label>
              <ProductPicker
                storeId={storeId}
                value={product}
                onChange={setProduct}
                quantity={quantity}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" {...form.register('quantity', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>COD Amount</Label>
              <Input type="number" {...form.register('cod_amount', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Courier (optional)</Label>
              <Select value={form.watch('courier_id')} onValueChange={(v) => form.setValue('courier_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                <SelectContent>
                  {MOCK_COURIERS.filter((c) => c.connection_status === 'connected').map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Area</Label>
              <Input {...form.register('delivery_area')} placeholder="e.g. Dhaka Zone" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Customer Note</Label>
              <Input {...form.register('customer_note')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Order Note</Label>
              <Input {...form.register('order_note')} />
            </div>
          </CardContent>
        </Card>

        {phone.length >= 11 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle>Customer History</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {customer ? (
                  <div className="space-y-2">
                    <p><span className="text-text-muted">Name:</span> {customer.name}</p>
                    <p><span className="text-text-muted">Total Orders:</span> {customer.total_orders}</p>
                    <p><span className="text-text-muted">Return Rate:</span> {customer.return_rate}%</p>
                  </div>
                ) : (
                  <p className="text-text-muted">New customer — no previous orders</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle>Fraud Risk Assessment</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {fraudLoading ? (
                  <p className="text-xs text-text-muted">Running hybrid fraud check…</p>
                ) : (
                  <>
                    <FraudRiskBadge level={fraudRisk.risk_level} score={fraudRisk.final_score} />
                    <p className="text-xs font-medium text-primary">{fraudRisk.recommended_action}</p>
                    <ul className="mt-2 space-y-1 text-xs text-text-muted">
                      {fraudRisk.reasons.map((r) => <li key={r}>• {r}</li>)}
                    </ul>
                    {fraudRisk.needs_call_confirmation && (
                      <p className="text-xs font-medium text-warning">⚠ Call confirmation recommended</p>
                    )}
                    {customer?.is_blacklisted && (
                      <p className="text-xs font-medium text-danger">⚠ Customer is blacklisted</p>
                    )}
                  </>
                )}
                {codAmount > 0 && <p className="text-xs">COD: {formatBDT(codAmount)}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link to="/orders"><Button variant="outline" type="button">Cancel</Button></Link>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {isEdit ? 'Save Changes' : 'Create Order'}
          </Button>
        </div>
      </form>
    </div>
  )
}
