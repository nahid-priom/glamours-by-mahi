import { useEffect, useId, useRef, useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  compareYmd,
  formatDisplayRange,
  resolveShortcut,
  todayYmd,
  type DateShortcut,
} from '@/lib/datetime/bd'
import { CalendarMonth } from './calendar-month'

export type AppDatePickerMode = 'single' | 'range'

export type AppDatePickerValue = {
  from: string | null
  to: string | null
  shortcut?: DateShortcut | 'custom' | null
}

type Props = {
  mode?: AppDatePickerMode
  value: AppDatePickerValue
  onChange: (next: AppDatePickerValue) => void
  /** Allow switching single/range inside the panel (filter bars). */
  allowModeToggle?: boolean
  placeholder?: string
  clearable?: boolean
  className?: string
  disabled?: boolean
}

const SHORTCUTS: Array<{ id: DateShortcut; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
]

export function AppDatePicker({
  mode: modeProp = 'single',
  value,
  onChange,
  allowModeToggle = false,
  placeholder,
  clearable = true,
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AppDatePickerMode>(modeProp)
  const [viewMonth, setViewMonth] = useState(() => value.from ?? todayYmd())
  const [rangeDraft, setRangeDraft] = useState<'from' | 'to'>('from')
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    setMode(modeProp)
  }, [modeProp])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label =
    placeholder ??
    (mode === 'single'
      ? formatDisplayRange(value.from, value.from)
      : formatDisplayRange(value.from, value.to))

  function applyShortcut(id: DateShortcut) {
    const range = resolveShortcut(id)
    if (mode === 'single') {
      onChange({ from: range.to, to: range.to, shortcut: id })
    } else {
      onChange({ from: range.from, to: range.to, shortcut: id })
    }
    setOpen(false)
  }

  function selectDay(ymd: string) {
    if (mode === 'single') {
      onChange({ from: ymd, to: ymd, shortcut: 'custom' })
      setOpen(false)
      return
    }

    if (rangeDraft === 'from' || !value.from) {
      onChange({ from: ymd, to: ymd, shortcut: 'custom' })
      setRangeDraft('to')
      return
    }

    let from = value.from
    let to = ymd
    if (compareYmd(from, to) > 0) {
      const tmp = from
      from = to
      to = tmp
    }
    onChange({ from, to, shortcut: 'custom' })
    setRangeDraft('from')
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative inline-block ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) {
            setViewMonth(value.from ?? todayYmd())
            setRangeDraft('from')
          }
          setOpen((v) => !v)
        }}
        className="inline-flex h-9 min-w-[10.5rem] items-center gap-2 rounded-md border border-border bg-white px-2.5 text-left text-sm text-[#111827] hover:bg-slate-50 disabled:opacity-50"
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
        <span className="truncate">{label}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 z-50 mt-1 rounded-xl border border-border bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex flex-wrap gap-1">
            {SHORTCUTS.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={value.shortcut === s.id ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => applyShortcut(s.id)}
              >
                {s.label}
              </Button>
            ))}
          </div>

          {allowModeToggle ? (
            <div className="mb-2 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={mode === 'single' ? 'default' : 'outline'}
                className="h-7 flex-1 text-xs"
                onClick={() => {
                  setMode('single')
                  if (value.from) onChange({ from: value.from, to: value.from, shortcut: 'custom' })
                }}
              >
                Single day
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'range' ? 'default' : 'outline'}
                className="h-7 flex-1 text-xs"
                onClick={() => setMode('range')}
              >
                From – To
              </Button>
            </div>
          ) : null}

          {mode === 'range' ? (
            <p className="mb-2 text-[11px] text-[#6B7280]">
              {rangeDraft === 'from' ? 'Pick start date' : 'Pick end date'} · BD (Asia/Dhaka)
            </p>
          ) : (
            <p className="mb-2 text-[11px] text-[#6B7280]">Bangladesh time · day 12:01 AM – 11:59 PM</p>
          )}

          <CalendarMonth
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            from={value.from}
            to={mode === 'single' ? value.from : value.to}
            onSelectDay={selectDay}
          />

          <div className="mt-2 flex justify-between gap-2">
            {clearable ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  onChange({ from: null, to: null, shortcut: null })
                  setOpen(false)
                }}
              >
                Clear
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
