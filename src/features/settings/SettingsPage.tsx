import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Archive, RotateCcw } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { settingsService } from './settings.service'
import { RoleFormDialog } from './RoleFormDialog'
import { ApiSettingsPanel } from './ApiSettingsPanel'
import { APP_NAME } from '@/lib/constants'
import type { RoleEntry, RoleFormInput, LabelSize, DefaultPrintType } from './settings.types'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleEntry | null>(null)
  const [archiveRoleTarget, setArchiveRoleTarget] = useState<RoleEntry | null>(null)
  const [labelSize, setLabelSize] = useState<LabelSize>('100x150')
  const [defaultPrintType, setDefaultPrintType] = useState<DefaultPrintType>('invoice')
  const [showPoweredBy, setShowPoweredBy] = useState(true)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getSettings(),
  })

  useEffect(() => {
    if (!settings) return
    setLabelSize(settings.print.label_size)
    setDefaultPrintType(settings.print.default_print_type)
    setShowPoweredBy(settings.print.show_powered_by)
  }, [settings])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['settings'] })

  const updateCompanyMutation = useMutation({
    mutationFn: settingsService.updateCompany,
    onSuccess: () => { invalidate(); toast('Company profile saved') },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updatePrintMutation = useMutation({
    mutationFn: settingsService.updatePrint,
    onSuccess: () => { invalidate(); toast('Print settings saved') },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updateApiMutation = useMutation({
    mutationFn: settingsService.updateApi,
    onSuccess: () => { invalidate(); toast('API preferences saved') },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const createRoleMutation = useMutation({
    mutationFn: (data: RoleFormInput) => settingsService.createRole(data),
    onSuccess: () => { invalidate(); toast('Role added') },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleFormInput }) =>
      settingsService.updateRole(id, data),
    onSuccess: () => { invalidate(); toast('Role updated') },
  })

  const archiveRoleMutation = useMutation({
    mutationFn: (id: string) => settingsService.archiveRole(id),
    onSuccess: () => { invalidate(); toast('Role archived'); setArchiveRoleTarget(null) },
  })

  const restoreRoleMutation = useMutation({
    mutationFn: (id: string) => settingsService.restoreRole(id),
    onSuccess: () => { invalidate(); toast('Role restored') },
  })

  if (isLoading || !settings) {
    return (
      <PageShell title="Settings" description="System configuration and preferences">
        <LoadingSkeleton rows={6} />
      </PageShell>
    )
  }

  const activeRoles = settings.roles.filter((r) => !r.deleted_at)
  const archivedRoles = settings.roles.filter((r) => r.deleted_at)

  const handleRoleSubmit = async (data: RoleFormInput) => {
    if (editingRole) {
      await updateRoleMutation.mutateAsync({ id: editingRole.id, data })
    } else {
      await createRoleMutation.mutateAsync(data)
    }
    setEditingRole(null)
  }

  return (
    <PageShell title="Settings" description="System configuration and preferences">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                updateCompanyMutation.mutate({
                  company_name: String(fd.get('company_name')),
                  phone: String(fd.get('phone')),
                  email: String(fd.get('email')),
                  website: String(fd.get('website')),
                  address: String(fd.get('address')),
                  logo_url: String(fd.get('logo_url')),
                })
              }}
            >
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input name="company_name" defaultValue={settings.company.company_name} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={settings.company.phone} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={settings.company.email} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input name="website" defaultValue={settings.company.website} />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input name="address" defaultValue={settings.company.address} />
              </div>
              <div className="space-y-1.5">
                <Label>Logo URL</Label>
                <Input name="logo_url" defaultValue={settings.company.logo_url} placeholder="https://..." />
              </div>
              <Button type="submit" disabled={updateCompanyMutation.isPending}>
                Save Company Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Print Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                updatePrintMutation.mutate({
                  invoice_prefix: String(fd.get('invoice_prefix')),
                  label_size: labelSize,
                  show_powered_by: showPoweredBy,
                  default_print_type: defaultPrintType,
                })
              }}
            >
              <div className="space-y-1.5">
                <Label>Invoice Prefix</Label>
                <Input name="invoice_prefix" defaultValue={settings.print.invoice_prefix} />
              </div>
              <div className="space-y-1.5">
                <Label>Label Size</Label>
                <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100x150">100mm × 150mm</SelectItem>
                    <SelectItem value="80x100">80mm × 100mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Default Print Type</Label>
                <Select
                  value={defaultPrintType}
                  onValueChange={(v) => setDefaultPrintType(v as DefaultPrintType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice A4</SelectItem>
                    <SelectItem value="shipping_label">Shipping Label</SelectItem>
                    <SelectItem value="gift_label">Gift Label</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showPoweredBy}
                  onCheckedChange={(v) => setShowPoweredBy(!!v)}
                />
                Show &quot;Powered by {APP_NAME}&quot; on prints
              </label>
              <Button type="submit" disabled={updatePrintMutation.isPending}>
                Save Print Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <ApiSettingsPanel
              settings={settings.api}
              onSave={async (data) => { await updateApiMutation.mutateAsync(data) }}
              loading={updateApiMutation.isPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>User Roles</CardTitle>
            <Button
              size="sm"
              onClick={() => { setEditingRole(null); setRoleFormOpen(true) }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Role
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between rounded-xl border border-border p-3"
              >
                <div>
                  <p className="font-medium">{role.name}</p>
                  <p className="text-xs text-text-muted">{role.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <Badge key={p} variant="default">{p}</Badge>
                    ))}
                    {!role.is_active && <Badge variant="warning">Inactive</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingRole(role); setRoleFormOpen(true) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setArchiveRoleTarget(role)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {archivedRoles.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-medium text-text-muted">Archived Roles</p>
                {archivedRoles.map((role) => (
                  <div
                    key={role.id}
                    className="mb-2 flex items-center justify-between rounded-xl border border-dashed border-border p-3 opacity-60"
                  >
                    <span className="text-sm">{role.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restoreRoleMutation.mutate(role.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RoleFormDialog
        open={roleFormOpen}
        onOpenChange={setRoleFormOpen}
        role={editingRole}
        onSubmit={handleRoleSubmit}
        loading={createRoleMutation.isPending || updateRoleMutation.isPending}
      />

      <ConfirmDialog
        open={!!archiveRoleTarget}
        onOpenChange={() => setArchiveRoleTarget(null)}
        title="Archive Role"
        description={`Archive role "${archiveRoleTarget?.name}"?`}
        confirmLabel="Archive"
        variant="danger"
        loading={archiveRoleMutation.isPending}
        onConfirm={() => archiveRoleTarget && archiveRoleMutation.mutate(archiveRoleTarget.id)}
      />
    </PageShell>
  )
}
