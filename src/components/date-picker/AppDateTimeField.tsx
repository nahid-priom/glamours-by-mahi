import { AppDateField } from './AppDateField'
import { Input } from '@/components/ui/input'

type Props = {
  /** ISO or `YYYY-MM-DDTHH:mm` local-ish value */
  value: string
  onChange: (next: string) => void
  label?: string
  className?: string
}

function split(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '00:01' }
  const [date, timePart] = value.includes('T') ? value.split('T') : value.split(' ')
  const time = (timePart ?? '00:01').slice(0, 5)
  return { date: date?.slice(0, 10) ?? '', time: time || '00:01' }
}

/** Date from SSOT calendar + separate time input (no second calendar). */
export function AppDateTimeField({ value, onChange, label, className }: Props) {
  const { date, time } = split(value)
  return (
    <div className={className}>
      {label ? <p className="mb-1 text-xs text-[#6B7280]">{label}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <AppDateField
          value={date}
          onChange={(ymd) => onChange(ymd ? `${ymd}T${time}` : '')}
        />
        <Input
          type="time"
          className="h-9 w-[7.5rem]"
          value={time}
          onChange={(e) => onChange(date ? `${date}T${e.target.value}` : '')}
        />
      </div>
    </div>
  )
}
