import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  compareYmd,
  formatDisplayYmd,
  monthGrid,
  parseYmd,
  shiftMonth,
  todayYmd,
} from '@/lib/datetime/bd'

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

type Props = {
  viewMonth: string
  onViewMonthChange: (ymd: string) => void
  from: string | null
  to: string | null
  onSelectDay: (ymd: string) => void
}

export function CalendarMonth({ viewMonth, onViewMonthChange, from, to, onSelectDay }: Props) {
  const cells = monthGrid(viewMonth)
  const { y, m } = parseYmd(viewMonth)
  const today = todayYmd()
  const title = formatDisplayYmd(viewMonth).replace(/^\d{2}\s/, '')

  function inRange(day: string): boolean {
    if (!from || !to) return false
    return compareYmd(day, from) >= 0 && compareYmd(day, to) <= 0
  }

  return (
    <div className="w-[280px] select-none">
      <div className="mb-2 flex items-center justify-between gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onViewMonthChange(shiftMonth(viewMonth, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold text-[#111827]">
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} {y}
        </p>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onViewMonthChange(shiftMonth(viewMonth, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-[#9CA3AF]">
        {DOW.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="h-8" />
          const selected = day === from || day === to
          const ranged = inRange(day) && !selected
          const isToday = day === today
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={[
                'h-8 rounded-md text-xs font-medium transition-colors',
                selected ? 'bg-[#111827] text-white' : '',
                ranged ? 'bg-slate-100 text-[#111827]' : '',
                !selected && !ranged ? 'text-[#111827] hover:bg-slate-50' : '',
                isToday && !selected ? 'ring-1 ring-inset ring-[#111827]/40' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={formatDisplayYmd(day)}
              aria-current={isToday ? 'date' : undefined}
            >
              {parseYmd(day).d}
            </button>
          )
        })}
      </div>
      <p className="sr-only">{title}</p>
    </div>
  )
}
