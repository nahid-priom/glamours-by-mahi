import { useState } from 'react'
import { MapPin, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useAccount } from './account.context'
import {
  addAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from './account.service'
import type { AddressLabel, SavedAddress } from './account.types'

const LABELS: AddressLabel[] = ['Home', 'Office', 'Other']

const emptyForm = (): Omit<SavedAddress, 'id'> => ({
  fullName: '',
  phone: '',
  district: '',
  area: '',
  address: '',
  label: 'Home',
  isDefault: false,
})

export function AccountAddressesPage() {
  const { session } = useAccount()
  const { toast } = useToast()
  const phone = session?.phone ?? ''

  const [addresses, setAddresses] = useState<SavedAddress[]>(() => getAddresses(phone))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const refresh = () => setAddresses(getAddresses(phone))

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm(),
      fullName: session?.name ?? '',
      phone: session?.phone ?? '',
      district: session?.district ?? '',
      address: session?.address ?? '',
      isDefault: addresses.length === 0,
    })
    setShowForm(true)
  }

  const openEdit = (addr: SavedAddress) => {
    setEditingId(addr.id)
    setForm({ ...addr })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.fullName || !form.phone || !form.address || !form.district) {
      toast('Please fill all required fields', 'error')
      return
    }
    if (editingId) {
      updateAddress(phone, editingId, form)
      toast('Address updated')
    } else {
      addAddress(phone, form)
      toast('Address added')
    }
    refresh()
    setShowForm(false)
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    deleteAddress(phone, id)
    refresh()
    toast('Address removed')
  }

  const handleSetDefault = (id: string) => {
    updateAddress(phone, id, { isDefault: true })
    refresh()
    toast('Default address updated')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#22171C]/8 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="font-serif text-2xl text-[#22171C]">Addresses</h2>
          <p className="mt-1 text-sm text-[#6B7280]">Manage delivery locations for faster checkout</p>
        </div>
        <Button onClick={openCreate} className="rounded-full">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Address
        </Button>
      </div>

      {showForm && (
        <div className="rounded-3xl border border-[#22171C]/8 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="font-medium text-[#22171C]">{editingId ? 'Edit Address' : 'New Address'}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="District" value={form.district} onChange={(v) => setForm({ ...form, district: v })} />
            <Field label="Area" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
            <div className="sm:col-span-2">
              <Field label="Full Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6B7280]">Label</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setForm({ ...form, label })}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition',
                      form.label === label
                        ? 'bg-[#22171C] text-white'
                        : 'border border-[#22171C]/10 text-[#6B7280]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} className="rounded-full">
              Save Address
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !showForm && (
        <div className="rounded-3xl border border-dashed border-[#22171C]/15 bg-white py-12 text-center">
          <MapPin className="mx-auto h-8 w-8 text-[#6B7280]/40" />
          <p className="mt-3 text-sm text-[#6B7280]">No saved addresses yet</p>
        </div>
      )}

      <ul className="space-y-3">
        {addresses.map((addr) => (
          <li
            key={addr.id}
            className={cn(
              'rounded-3xl border bg-white p-5 shadow-sm',
              addr.isDefault ? 'border-[#FF3F7F]/30' : 'border-[#22171C]/8',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#6B7280]">{addr.label}</span>
                  {addr.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF3F7F]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#FF3F7F]">
                      <Star className="h-3 w-3" />
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-2 font-medium text-[#22171C]">{addr.fullName}</p>
                <p className="mt-1 text-sm text-[#6B7280]">{addr.address}</p>
                <p className="text-sm text-[#6B7280]">
                  {addr.area}, {addr.district} · {addr.phone}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!addr.isDefault && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleSetDefault(addr.id)}>
                    Set Default
                  </Button>
                )}
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(addr)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-[#FF3F7F]"
                  onClick={() => handleDelete(addr.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6B7280]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 rounded-xl" />
    </div>
  )
}
