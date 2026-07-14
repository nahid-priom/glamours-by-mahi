import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { DashboardSectionCard } from './DashboardSectionCard'

interface AttendanceSummaryCardProps {
  present: number
  late: number
  absent: number
  leave: number
  employees: {
    id: string
    name: string
    role: string
    status: string
    checkIn: string
  }[]
}

const statusTone: Record<string, string> = {
  Present: 'bg-emerald-50 text-emerald-700',
  Late: 'bg-amber-50 text-amber-700',
  Absent: 'bg-rose-50 text-rose-700',
  Leave: 'bg-sky-50 text-sky-700',
  Overtime: 'bg-emerald-50 text-emerald-700',
  'Early Leave': 'bg-amber-50 text-amber-700',
}

export function AttendanceSummaryCard({
  present,
  late,
  absent,
  leave,
  employees,
}: AttendanceSummaryCardProps) {
  return (
    <DashboardSectionCard title="Employee Attendance" action={{ label: 'View attendance', to: '/hr/attendance' }}>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['Present', present, 'text-emerald-600'],
          ['Late', late, 'text-amber-600'],
          ['Absent', absent, 'text-[#E11D48]'],
          ['Leave', leave, 'text-sky-600'],
        ].map(([label, value, color]) => (
          <div key={label as string} className="rounded-xl bg-[#F8F6F2] py-2.5">
            <p className={cn('text-lg font-semibold', color as string)}>{value as number}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">{label as string}</p>
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {employees.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl px-1 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#111111]">{e.name}</p>
              <p className="text-[11px] text-[#6B7280]">
                {e.role}
                {e.checkIn ? ` · ${e.checkIn}` : ''}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                statusTone[e.status] ?? 'bg-slate-50 text-slate-700',
              )}
            >
              {e.status}
            </span>
          </li>
        ))}
        {employees.length === 0 && (
          <p className="text-sm text-[#6B7280]">
            No attendance marked today.{' '}
            <Link to="/hr/attendance" className="font-semibold text-[#E11D48]">
              Open HR
            </Link>
          </p>
        )}
      </ul>
    </DashboardSectionCard>
  )
}
