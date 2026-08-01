import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { inviteAdminUser, listAdminRoles } from '../repositories/administration.repository'

export function AdminUserInvitePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState('')

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listAdminRoles,
  })

  const invite = useMutation({
    mutationFn: () =>
      inviteAdminUser({
        email: email.trim(),
        full_name: fullName.trim(),
        role_id: roleId || null,
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast(`Invite sent to ${res.email}`)
      navigate('/administration/users')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/administration/users">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Users
        </Link>
      </Button>
      <h1 className="text-xl font-bold">Invite staff user</h1>
      <p className="text-sm text-[#6B7280]">
        Sends a Supabase invite email — no plain-text password is stored.
      </p>

      <div className="space-y-3 rounded-xl border bg-white p-4">
        <div>
          <Label>Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Role</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">Select role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={invite.isPending || !email.trim() || !fullName.trim()}
          onClick={() => invite.mutate()}
        >
          {invite.isPending ? 'Sending invite…' : 'Send invite'}
        </Button>
      </div>
    </div>
  )
}
