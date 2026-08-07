import { AppDatePicker } from './AppDatePicker'

type Props = {
  value: string
  onChange: (ymd: string) => void
  label?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
  /** For react-hook-form style name= display only */
  id?: string
}

/** Single-date form field — SSOT calendar (never native type=date). */
export function AppDateField({
  value,
  onChange,
  label,
  className,
  disabled,
  clearable = false,
  id,
}: Props) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="text-xs text-[#6B7280]">
          {label}
        </label>
      ) : null}
      <div className={label ? 'mt-1' : undefined}>
        <AppDatePicker
          mode="single"
          value={{ from: value || null, to: value || null }}
          onChange={(next) => onChange(next.from ?? '')}
          clearable={clearable}
          disabled={disabled}
          className="block w-full [&>button]:w-full"
        />
      </div>
    </div>
  )
}
