import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { courierRepository } from '../repositories/courier.repository'
import { EntityCombobox } from '@/components/entity-combobox'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { queryKeys } from '@/lib/query/keys'

export function ParcelBookingPage() {
  const { profile, activeBranchId } = useAuth()
  const [companyId, setCompanyId] = useState('')
  const [saleId, setSaleId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [cod, setCod] = useState(0)
  const [charge, setCharge] = useState(0)
  const [tracking, setTracking] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const { data: companies = [] } = useQuery({
    queryKey: queryKeys.couriers,
    queryFn: () => courierRepository.listCompanies(),
  })

  const book = useMutation({
    mutationFn: () => {
      if (!profile || !companyId) throw new Error('Company required')
      return courierRepository.bookParcel({
        organization_id: profile.organization_id,
        branch_id: activeBranchId,
        courier_company_id: companyId,
        sale_id: saleId,
        tracking_no: tracking || undefined,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: address,
        cod_amount: cod,
        courier_charge: charge,
      })
    },
    onSuccess: (data) => {
      setResult(`Booked ${data.tracking_no}`)
      setTracking('')
      setCustomerName('')
      setCustomerPhone('')
      setAddress('')
      setCod(0)
      setCharge(0)
      setSaleId(null)
    },
  })

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Parcel Booking</h1>
        <p className="text-sm text-[#6B7280]">Create a courier parcel and tracking event.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        <select
          className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">Courier company…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <EntityCombobox
          value={saleId}
          onChange={(id, opt) => {
            setSaleId(id)
            if (opt && 'customerName' in (opt as object)) {
              const o = opt as { customerName?: string; customerPhone?: string }
              if (o.customerName) setCustomerName(o.customerName)
              if (o.customerPhone) setCustomerPhone(o.customerPhone)
            }
          }}
          onSearch={courierRepository.searchSales}
          placeholder="Link sale (optional)…"
          allowClear
        />

        <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <Input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        <Input placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input placeholder="Tracking no (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" placeholder="COD" value={cod || ''} onChange={(e) => setCod(Number(e.target.value) || 0)} />
          <Input
            type="number"
            placeholder="Charge"
            value={charge || ''}
            onChange={(e) => setCharge(Number(e.target.value) || 0)}
          />
        </div>

        {book.error ? (
          <p className="text-sm text-[#E11D48]">
            {book.error instanceof Error ? book.error.message : 'Failed'}
          </p>
        ) : null}
        {result ? <p className="text-sm text-emerald-700">{result}</p> : null}

        <PermissionGate permission="courier.manage">
          <Button disabled={!companyId || book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? 'Booking…' : 'Book parcel'}
          </Button>
        </PermissionGate>
      </div>
    </div>
  )
}
