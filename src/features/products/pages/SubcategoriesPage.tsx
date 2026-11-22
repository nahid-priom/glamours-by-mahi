import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { QuickCreateNamedEntityDialog } from '../components/QuickCreateNamedEntityDialog'
import {
  createCategory,
  createSubcategory,
  listSubcategories,
  searchCategories,
  softDeleteSubcategory,
  updateSubcategory,
  type SubcategoryRow,
} from '../repositories/catalog.repository'

type FormState = {
  category_id: string | null
  name: string
  code: string
  description: string
  sort_order: string
  is_active: boolean
}

const empty: FormState = {
  category_id: null,
  name: '',
  code: '',
  description: '',
  sort_order: '0',
  is_active: true,
}

export function SubcategoriesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SubcategoryRow | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null)
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)

  const onSearchCategories = useCallback((q: string) => searchCategories(q), [])

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.subcategories({ search, categoryId: filterCategoryId }),
    queryFn: () =>
      listSubcategories({ search, categoryId: filterCategoryId, pageSize: 100 }),
  })

  const applyCategory = useCallback((id: string | null, option?: EntityOption | null) => {
    setForm((f) => ({ ...f, category_id: id }))
    setCategoryLabel(option?.label ?? null)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization')
      if (!form.category_id) throw new Error('Category is required')
      const payload = {
        category_id: form.category_id,
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      }
      if (editing) return updateSubcategory(editing.id, payload)
      return createSubcategory(profile.organization_id, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subcategories'] })
      toast(editing ? 'Subcategory updated' : 'Subcategory created')
      setOpen(false)
      setEditing(null)
      setForm(empty)
      setCategoryLabel(null)
    },
    onError: (e: Error) => toastRpcError(toast, e, 'Could not save subcategory.'),
  })

  const deleteMutation = useMutation({
    mutationFn: softDeleteSubcategory,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subcategories'] })
      toast('Subcategory deleted')
    },
    onError: (e: Error) => toastRpcError(toast, e, 'Could not delete subcategory.'),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty, category_id: filterCategoryId })
    setCategoryLabel(null)
    setOpen(true)
  }

  const openEdit = (row: SubcategoryRow) => {
    setEditing(row)
    setForm({
      category_id: row.category_id,
      name: row.name,
      code: row.code ?? '',
      description: row.description ?? '',
      sort_order: String(row.sort_order),
      is_active: row.is_active,
    })
    setCategoryLabel(row.categories?.name ?? null)
    setOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Subcategories</h1>
          <p className="text-sm text-[#6B7280]">Nest product groups under a category.</p>
        </div>
        <PermissionGate permission="products.create">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add subcategory
          </Button>
        </PermissionGate>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="w-full max-w-xs">
          <EntityCombobox
            value={filterCategoryId}
            onChange={(id) => setFilterCategoryId(id)}
            onSearch={onSearchCategories}
            placeholder="Filter by category"
            aria-label="Filter by category"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load subcategories.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-[#6B7280]">{row.categories?.name ?? '—'}</TableCell>
                <TableCell className="text-[#6B7280]">{row.code ?? '—'}</TableCell>
                <TableCell>{row.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <PermissionGate permission="products.update">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[#E11D48]"
                        onClick={() => {
                          if (confirm(`Delete “${row.name}”?`)) deleteMutation.mutate(row.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No subcategories yet.</p>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setEditing(null)
            setForm(empty)
            setCategoryLabel(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit subcategory' : 'New subcategory'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              saveMutation.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label>Category</Label>
              <EntityCombobox
                value={form.category_id}
                onChange={applyCategory}
                onSearch={onSearchCategories}
                placeholder="Select category"
                aria-label="Category"
                initialLabel={categoryLabel}
                onCreate={() => setCreateCategoryOpen(true)}
                createLabel="Create new category"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">Name</Label>
              <Input
                id="sub-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-code">Code</Label>
              <Input
                id="sub-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-sort">Sort</Label>
                <Input
                  id="sub-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <QuickCreateNamedEntityDialog
        open={createCategoryOpen}
        onOpenChange={setCreateCategoryOpen}
        title="Create category"
        namePlaceholder="Category name"
        onSubmit={async ({ name }) => {
          if (!profile?.organization_id) throw new Error('No organization')
          const row = await createCategory(profile.organization_id, { name, is_active: true })
          return { id: row.id, label: row.name, meta: { code: row.code ?? undefined } }
        }}
        onCreated={(opt) => {
          applyCategory(opt.id, opt)
          void qc.invalidateQueries({ queryKey: ['categories'] })
        }}
        onError={(message) => toast(message)}
      />
    </div>
  )
}
