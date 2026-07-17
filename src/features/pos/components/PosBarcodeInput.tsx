import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Loader2, ScanBarcode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { normalizeBarcode } from '../cart-utils'

const SCAN_LOCK_MS = 250

export type PosBarcodeInputHandle = {
  focus: () => void
  focusAndSelect: () => void
  clear: () => void
  setValue: (value: string) => void
}

export type PosBarcodeInputProps = {
  onScan: (code: string) => void | Promise<void>
  disabled?: boolean
  loading?: boolean
  className?: string
  placeholder?: string
}

export const PosBarcodeInput = forwardRef<PosBarcodeInputHandle, PosBarcodeInputProps>(
  function PosBarcodeInput(
    {
      onScan,
      disabled = false,
      loading = false,
      className,
      placeholder = 'Scan or enter barcode...',
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null)
    const lockedUntil = useRef(0)
    const [value, setValue] = useState('')

    const focus = useCallback(() => {
      requestAnimationFrame(() => inputRef.current?.focus())
    }, [])

    const focusAndSelect = useCallback(() => {
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        el.select()
      })
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        focus,
        focusAndSelect,
        clear: () => setValue(''),
        setValue: (next: string) => setValue(next),
      }),
      [focus, focusAndSelect],
    )

    useEffect(() => {
      if (!disabled) focus()
    }, [disabled, focus])

    const submit = useCallback(async () => {
      const code = normalizeBarcode(value)
      if (!code || disabled || loading) return
      const now = Date.now()
      if (now < lockedUntil.current) return
      lockedUntil.current = now + SCAN_LOCK_MS
      try {
        await onScan(code)
      } finally {
        focus()
      }
    }, [value, disabled, loading, onScan, focus])

    return (
      <form
        className={cn('relative', className)}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          ref={inputRef}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Barcode scanner input"
          autoComplete="off"
          autoFocus
          className="h-11 pl-9 pr-10 text-base"
          onChange={(e) => setValue(e.target.value)}
        />
        {loading ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted"
            aria-label="Looking up barcode"
          />
        ) : null}
      </form>
    )
  },
)
