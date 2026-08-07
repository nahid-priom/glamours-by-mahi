import { AppDatePicker, type AppDatePickerValue } from './AppDatePicker'
import type { DateShortcut } from '@/lib/datetime/bd'

type Props = {
  from: string
  to: string
  onChange: (next: { from: string; to: string; shortcut?: DateShortcut | 'custom' | null }) => void
  label?: string
  className?: string
  allowModeToggle?: boolean
  clearable?: boolean
  disabled?: boolean
}

/** From–to filter field — same SSOT calendar as single-date. */
export function AppDateRangeField({
  from,
  to,
  onChange,
  label,
  className,
  allowModeToggle = true,
  clearable = true,
  disabled,
}: Props) {
  const value: AppDatePickerValue = {
    from: from || null,
    to: to || null,
  }

  return (
    <div className={className}>
      {label ? <p className="mb-1 text-xs text-[#6B7280]">{label}</p> : null}
      <AppDatePicker
        mode="range"
        allowModeToggle={allowModeToggle}
        value={value}
        onChange={(next) =>
          onChange({
            from: next.from ?? '',
            to: next.to ?? next.from ?? '',
            shortcut: next.shortcut,
          })
        }
        clearable={clearable}
        disabled={disabled}
        className="block w-full [&>button]:w-full"
      />
    </div>
  )
}
