import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierRepository } from '../repositories/courier.repository'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { queryKeys } from '@/lib/query/keys'

export function CourierCompaniesPage() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: queryKeys.couriers,
    queryFn: () => courierRepository.listCompanies(),
  })

  const create = useMutation({
    mutationFn: () =>
      courierRepository.upsertCompany({
        organization_id: profile!.organization_id,
        name,
        code: code || null,
        contact_phone: phone || null,
      }),
    onSuccess: async () => {
      setName('')
      setCode('')
      setPhone('')
      await qc.invalidateQueries({ queryKey: queryKeys.couriers })
    },
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Courier Companies</h1>
        <p className="text-sm text-[#6B7280]">Active courier partners and connection status.</p>
      </div>

      <PermissionGate permission="courier.manage">
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-white p-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="w-28" />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-40" />
          <Button disabled={!name || !profile || create.isPending} onClick={() => create.mutate()}>
            Add
          </Button>
        </div>
      </PermissionGate>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load companies.</p> : null}

      <ul className="space-y-2">
        {data.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
          >
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-[#9CA3AF]">
                {c.code || '—'} · {c.contact_phone || 'no phone'} · {c.connection_status}
              </p>
            </div>
            <span className="text-xs font-medium uppercase text-[#6B7280]">{c.status}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
