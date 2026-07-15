import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { normalizeBarcode } from '../cart-utils'

const SCAN_LOCK_MS = 200

export type PosBarcodeInputProps = {
  onScan: (code: string) => void | Promise<void>
  disabled?: boolean
  className?: string
  placeholder?: string
}

export const PosBarcodeInput = forwardRef<HTMLInputElement, PosBarcodeInputProps>(
  function PosBarcodeInput(
    { onScan, disabled = false, className, placeholder = 'Scan barcode…' },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null)
    const lockedUntil = useRef(0)
    const [value, setValue] = useState('')

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    useEffect(() => {
      if (!disabled) inputRef.current?.focus()
    }, [disabled])

    const submit = useCallback(async () => {
      const code = normalizeBarcode(value)
      if (!code || disabled) return
      const now = Date.now()
      if (now < lockedUntil.current) return
      lockedUntil.current = now + SCAN_LOCK_MS
      setValue('')
      try {
        await onScan(code)
      } finally {
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }, [value, disabled, onScan])

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
          className="pl-9"
          onChange={(e) => setValue(e.target.value)}
        />
      </form>
    )
  },
)
