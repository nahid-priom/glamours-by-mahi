import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { createEmployee } from '../repositories/employees.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  EmployeeFormFields,
  emptyEmployeeForm,
  formToEmployeeInput,
  type EmployeeFormState,
} from '../components/EmployeeFormFields'

export function EmployeeCreatePage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<EmployeeFormState>(emptyEmployeeForm)

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabase/client')
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization')
      const payload = formToEmployeeInput(form)
      if (!payload.employee_code.trim()) throw new Error('Employee code is required')
      if (!payload.full_name.trim()) throw new Error('Full name is required')
      return createEmployee(profile.organization_id, payload)
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
      toast('Employee created')
      navigate(`/hr/employees/${row.id}`, { replace: true })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/hr/employees">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Employees
        </Link>
      </Button>
      <div>
        <h1 className="font-serif text-3xl text-[#111111]">Add employee</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Create the HR record first, then provision a login from the employee detail page.
        </p>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <EmployeeFormFields form={form} setForm={setForm} branches={branches} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to="/hr/employees">Cancel</Link>
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Create employee'}
          </Button>
        </div>
      </div>
    </div>
  )
}
