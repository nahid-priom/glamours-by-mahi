import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { AppDateTimeField } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { EmptyState } from '@/components/shared/EmptyState'
import { EntityCombobox } from '@/components/entity-combobox'
import { searchCustomers } from '@/features/customers/repositories/customers.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  completeStaffFollowUp,
  listStaffFollowUps,
  upsertStaffFollowUp,
} from '../repositories/staff.repository'

export function FollowUpsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['staff-follow-ups'],
    queryFn: () => listStaffFollowUps({ status: 'pending', limit: 50 }),
  })

  const createMut = useMutation({
    mutationFn: () => {
      if (!customerId || !when) throw new Error('Customer and time required')
      return upsertStaffFollowUp({
        customer_id: customerId,
        follow_up_at: new Date(when).toISOString(),
        note: note || null,
        priority: 'normal',
      })
    },
    onSuccess: async () => {
      toast('Follow-up সেভ হয়েছে')
      setNote('')
      await qc.invalidateQueries({ queryKey: ['staff-follow-ups'] })
      await qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const completeMut = useMutation({
    mutationFn: (id: string) => completeStaffFollowUp(id),
    onSuccess: async () => {
      toast('Follow-up সম্পন্ন')
      await qc.invalidateQueries({ queryKey: ['staff-follow-ups'] })
      await qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">Follow-ups</h1>
        <p className="text-sm text-[#6B7280]">আজকের Call ও পরবর্তী কাজ</p>
      </div>

      <form
        className="space-y-3 rounded-2xl border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault()
          createMut.mutate()
        }}
      >
        <p className="text-sm font-semibold">নতুন Follow-up</p>
        <EntityCombobox
          value={customerId}
          onChange={setCustomerId}
          placeholder="Customer বেছে নিন"
          onSearch={searchCustomers}
        />
        <div className="space-y-1.5">
          <Label>সময়</Label>
          <AppDateTimeField value={when} onChange={setWhen} />
        </div>
        <div className="space-y-1.5">
          <Label>নোট</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="সংক্ষিপ্ত নোট" />
        </div>
        <Button type="submit" disabled={createMut.isPending}>
          Save Follow-up
        </Button>
      </form>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">{(error as Error).message}</p> : null}

      {data.length === 0 && !isLoading ? (
        <EmptyState title="Pending Follow-up নেই" description="নতুন Follow-up যোগ করুন।" />
      ) : (
        <ul className="space-y-2">
          {data.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{f.customer_name}</p>
                <p className="text-xs text-[#6B7280]">
                  {new Date(f.follow_up_at).toLocaleString()} · Due{' '}
                  {formatBDT(Number(f.current_due))}
                </p>
                {f.note ? <p className="mt-1 text-sm text-[#374151]">{f.note}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {f.customer_phone ? (
                  <>
                    <a
                      href={`tel:${f.customer_phone}`}
                      className="inline-flex h-11 items-center gap-1 rounded-xl bg-[#F3F4F6] px-3 text-sm font-medium"
                    >
                      <Phone className="h-4 w-4" /> Call
                    </a>
                    <a
                      href={`https://wa.me/88${f.customer_phone.replace(/\D/g, '').slice(-11)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center rounded-xl bg-[#25D366]/15 px-3 text-sm font-medium text-[#128C7E]"
                    >
                      WhatsApp
                    </a>
                  </>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={completeMut.isPending}
                  onClick={() => completeMut.mutate(f.id)}
                >
                  Done
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
