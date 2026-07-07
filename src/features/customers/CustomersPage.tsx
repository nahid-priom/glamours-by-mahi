import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  KpiGrid,
  EntityToolbar,
  ActionDropdown,
  MobileEntityCard,
  LoadingSkeleton,
  ConfirmDialog,
  SearchInput,
} from '@/components/common'
import { useToast } from '@/components/ui/toast'
import { FraudRiskBadge } from '@/features/fraud/FraudRiskBadge'
import { customersService } from './customers.service'
import { CustomerFormDialog } from './CustomerFormDialog'
import { CustomerDetailsDrawer } from './CustomerDetailsDrawer'
import { CustomerNoteDialog } from './CustomerNoteDialog'
import { formatBDT } from '@/lib/format'
import { FRAUD_LEVELS } from '@/lib/constants'
import type { Customer, CustomerFilters, CustomerFormInput, CustomerStatus } from './customers.types'
import type { ActionItem } from '@/components/common/ActionDropdown'

const selectTriggerClass = 'h-11 w-full sm:w-[160px]'

export function CustomersPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CustomerStatus | 'all'>('all')
  const [fraudLevel, setFraudLevel] = useState<(typeof FRAUD_LEVELS)[number] | 'all'>('all')
  const [blacklistFilter, setBlacklistFilter] = useState<boolean | 'all'>('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [noteTarget, setNoteTarget] = useState<Customer | null>(null)
  const [blacklistTarget, setBlacklistTarget] = useState<Customer | null>(null)
  const [blacklistReason, setBlacklistReason] = useState('')

  const filters = useMemo<CustomerFilters>(
    () => ({
      search,
      status,
      fraud_level: fraudLevel,
      is_blacklisted: blacklistFilter,
      include_deleted: showDeleted,
    }),
    [search, status, fraudLevel, blacklistFilter, showDeleted],
  )

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customersService.getAll(filters),
  })

  const { data: stats } = useQuery({
    queryKey: ['customers', 'stats'],
    queryFn: () => customersService.getStats(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customers'] })

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormInput) => customersService.create(data),
    onSuccess: () => {
      invalidate()
      toast('Customer created successfully')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerFormInput }) =>
      customersService.update(id, data),
    onSuccess: () => {
      invalidate()
      toast('Customer updated')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersService.softDelete(id),
    onSuccess: () => {
      invalidate()
      toast('Customer archived')
      setDeleteTarget(null)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => customersService.restore(id),
    onSuccess: () => {
      invalidate()
      toast('Customer restored')
    },
  })

  const blacklistMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      customersService.blacklist(id, reason),
    onSuccess: () => {
      invalidate()
      toast('Customer blacklisted')
      setBlacklistTarget(null)
      setBlacklistReason('')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const unblacklistMutation = useMutation({
    mutationFn: (id: string) => customersService.unblacklist(id),
    onSuccess: () => {
      invalidate()
      toast('Customer removed from blacklist')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const noteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      customersService.addNote(id, note),
    onSuccess: () => {
      invalidate()
      toast('Note saved')
      setNoteTarget(null)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const handleFormSubmit = async (data: CustomerFormInput) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
    setEditing(null)
  }

  const getActions = (c: Customer): ActionItem[] => {
    const items: ActionItem[] = [
      { label: 'View Details', onClick: () => setViewCustomer(c) },
      { label: 'Edit', onClick: () => { setEditing(c); setFormOpen(true) }, disabled: !!c.deleted_at },
      { label: 'Add Note', onClick: () => setNoteTarget(c) },
    ]

    if (!c.deleted_at) {
      if (c.is_blacklisted) {
        items.push({ label: 'Remove Blacklist', onClick: () => unblacklistMutation.mutate(c.id) })
      } else {
        items.push({ label: 'Blacklist', onClick: () => setBlacklistTarget(c), variant: 'danger' })
      }
      items.push({ separator: true, label: '', onClick: () => {} })
      items.push({
        label: 'Archive',
        onClick: () => setDeleteTarget(c),
        variant: 'danger',
      })
    } else {
      items.push({ label: 'Restore', onClick: () => restoreMutation.mutate(c.id) })
    }

    return items
  }

  const kpis = [
    { label: 'Total Customers', value: stats?.total ?? 0 },
    { label: 'Active', value: stats?.active ?? 0, color: 'text-success' },
    { label: 'Blocked', value: stats?.blocked ?? 0, color: 'text-danger' },
    { label: 'Blacklisted', value: stats?.blacklisted ?? 0, color: 'text-danger' },
    { label: 'High Risk', value: stats?.high_risk ?? 0, color: 'text-warning' },
    { label: 'Avg Return Rate', value: `${stats?.avg_return_rate ?? 0}%` },
  ]

  return (
    <PageShell
      title="Customers"
      description="Customer history and fraud risk management"
      actions={
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      }
    >
      <KpiGrid items={kpis} columns={3} />

      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <EntityToolbar
            search={
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by name, phone, email..."
              />
            }
            filters={
              <>
                <Select value={status} onValueChange={(v) => setStatus(v as CustomerStatus | 'all')}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={fraudLevel}
                  onValueChange={(v) => setFraudLevel(v as typeof fraudLevel)}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Fraud Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    {FRAUD_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={blacklistFilter === 'all' ? 'all' : blacklistFilter ? 'yes' : 'no'}
                  onValueChange={(v) =>
                    setBlacklistFilter(v === 'all' ? 'all' : v === 'yes')
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Blacklist" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="yes">Blacklisted</SelectItem>
                    <SelectItem value="no">Not Blacklisted</SelectItem>
                  </SelectContent>
                </Select>

                <label className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-1 text-sm text-slate-600">
                  <Checkbox
                    checked={showDeleted}
                    onCheckedChange={(checked) => setShowDeleted(checked === true)}
                  />
                  Show archived
                </label>
              </>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-hidden p-0">
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-left text-xs text-text-muted">
                      <th className="px-4 py-3 font-medium sm:px-5">Customer</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Phone</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Orders</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Spent</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Return Rate</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Fraud Risk</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers?.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-b border-border/50 hover:bg-slate-50/50 ${c.deleted_at ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-3 sm:px-5">
                          <button
                            type="button"
                            className="text-left font-medium hover:text-primary"
                            onClick={() => setViewCustomer(c)}
                          >
                            {c.name}
                          </button>
                          {c.is_blacklisted && (
                            <Badge variant="danger" className="ml-2 text-[10px]">BL</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 sm:px-5">{c.phone}</td>
                        <td className="px-4 py-3 sm:px-5">{c.total_orders}</td>
                        <td className="px-4 py-3 sm:px-5">{formatBDT(c.total_spent)}</td>
                        <td className="px-4 py-3 sm:px-5">{c.return_rate}%</td>
                        <td className="px-4 py-3 sm:px-5">
                          <FraudRiskBadge level={c.fraud_level} />
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <Badge
                            variant={
                              c.status === 'active'
                                ? 'success'
                                : c.status === 'blocked'
                                  ? 'danger'
                                  : 'default'
                            }
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <ActionDropdown items={getActions(c)} />
                        </td>
                      </tr>
                    ))}
                    {customers?.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-text-muted sm:px-5">
                          No customers found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {customers?.map((c) => (
                  <MobileEntityCard
                    key={c.id}
                    title={c.name}
                    subtitle={c.phone}
                    muted={!!c.deleted_at}
                    onClick={() => setViewCustomer(c)}
                    badges={
                      <>
                        <FraudRiskBadge level={c.fraud_level} />
                        {c.is_blacklisted && <Badge variant="danger">Blacklisted</Badge>}
                        <Badge
                          variant={
                            c.status === 'active'
                              ? 'success'
                              : c.status === 'blocked'
                                ? 'danger'
                                : 'default'
                          }
                        >
                          {c.status}
                        </Badge>
                      </>
                    }
                    rows={[
                      { label: 'Orders', value: c.total_orders },
                      { label: 'Spent', value: formatBDT(c.total_spent) },
                      { label: 'Return Rate', value: `${c.return_rate}%` },
                      { label: 'District', value: c.district || '—' },
                    ]}
                    actions={getActions(c)}
                  />
                ))}
                {customers?.length === 0 && (
                  <p className="py-8 text-center text-sm text-text-muted">No customers found</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <CustomerDetailsDrawer
        customer={viewCustomer}
        onClose={() => setViewCustomer(null)}
      />

      <CustomerNoteDialog
        open={!!noteTarget}
        onOpenChange={() => setNoteTarget(null)}
        customer={noteTarget}
        onSubmit={(note) => noteMutation.mutateAsync({ id: noteTarget!.id, note })}
        loading={noteMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Archive Customer"
        description={`Archive "${deleteTarget?.name}"? They will be hidden from the active list.`}
        confirmLabel="Archive"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <Dialog open={!!blacklistTarget} onOpenChange={() => { setBlacklistTarget(null); setBlacklistReason('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Blacklist — {blacklistTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input
              value={blacklistReason}
              onChange={(e) => setBlacklistReason(e.target.value)}
              placeholder="Why is this customer being blacklisted?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBlacklistTarget(null); setBlacklistReason('') }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!blacklistReason.trim() || blacklistMutation.isPending}
              onClick={() =>
                blacklistTarget &&
                blacklistMutation.mutate({ id: blacklistTarget.id, reason: blacklistReason.trim() })
              }
            >
              Blacklist Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
