import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type EntityOption = {
  id: string
  label: string
  description?: string
  meta?: Record<string, string | undefined>
}

export type EntityComboboxProps = {
  value: string | null
  onChange: (id: string | null, option?: EntityOption | null) => void
  onSearch: (q: string) => Promise<EntityOption[]>
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  onCreate?: () => void
  createLabel?: string
  emptyMessage?: string
  className?: string
  /** Hydrate the closed trigger label (e.g. edit form). */
  initialLabel?: string | null
  'aria-label'?: string
}

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return mobile
}

export function EntityCombobox({
  value,
  onChange,
  onSearch,
  placeholder = 'Search…',
  disabled = false,
  allowClear = true,
  onCreate,
  createLabel = 'Create new',
  emptyMessage = 'No results found',
  className,
  initialLabel = null,
  'aria-label': ariaLabel = 'Search and select',
}: EntityComboboxProps) {
  const listId = useId()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<EntityOption[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(initialLabel)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchGen = useRef(0)
  const skipNextDebounce = useRef(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>()

  const runSearch = useCallback(
    async (q: string) => {
      const gen = ++searchGen.current
      setLoading(true)
      try {
        const rows = await onSearch(q)
        if (gen === searchGen.current) {
          setOptions(rows)
          setActiveIndex(0)
        }
      } catch {
        if (gen === searchGen.current) setOptions([])
      } finally {
        if (gen === searchGen.current) setLoading(false)
      }
    },
    [onSearch],
  )

  const openPanel = useCallback(() => {
    if (disabled) return
    setQuery('')
    skipNextDebounce.current = true
    setOpen(true)
    void runSearch('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [disabled, runSearch])

  const closePanel = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const updatePanelPosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 240),
      zIndex: 80,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open || isMobile) return
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, isMobile, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, runSearch])

  useEffect(() => {
    if (!value) {
      setSelectedLabel(null)
      return
    }
    if (initialLabel) setSelectedLabel(initialLabel)
  }, [value, initialLabel])

  useEffect(() => {
    if (!open || isMobile) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      const root = document.getElementById(`entity-cb-${listId}`)
      if (root?.contains(target) || panelRef.current?.contains(target)) return
      closePanel()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, isMobile, listId, closePanel])

  const select = (opt: EntityOption) => {
    onChange(opt.id, opt)
    setSelectedLabel(opt.label)
    closePanel()
  }

  const clear = () => {
    onChange(null, null)
    setSelectedLabel(null)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePanel()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(options.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = options[activeIndex]
      if (opt) select(opt)
    }
  }

  const listBody = (
    <div
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      className="max-h-60 overflow-y-auto py-1"
    >
      {loading && options.length === 0 && (
        <div className="space-y-2 px-3 py-2" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      )}
      {!loading && options.length === 0 && (
        <p className="px-3 py-6 text-center text-sm text-text-muted">{emptyMessage}</p>
      )}
      {options.map((opt, i) => {
        const selected = opt.id === value
        const active = i === activeIndex
        return (
          <button
            key={opt.id}
            type="button"
            role="option"
            aria-selected={selected}
            className={cn(
              'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
              active && 'bg-slate-100',
              selected && 'font-medium',
            )}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => select(opt)}
          >
            <Check className={cn('mt-0.5 h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{opt.label}</span>
              {opt.description ? (
                <span className="block truncate text-xs text-text-muted">{opt.description}</span>
              ) : null}
            </span>
          </button>
        )
      })}
      {onCreate ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-primary hover:bg-slate-50"
          onClick={() => {
            closePanel()
            onCreate()
          }}
        >
          <Plus className="h-4 w-4" />
          {createLabel}
        </button>
      ) : null}
    </div>
  )

  const searchField = (
    <div className="relative border-b border-border p-2">
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-controls={listId}
        aria-expanded={open}
        autoComplete="off"
        className="pr-8"
      />
      {loading ? (
        <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
      ) : null}
    </div>
  )

  const trigger = (
    <div ref={triggerRef} className={cn('flex w-full min-w-0 gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-9 min-w-0 flex-1 justify-between overflow-hidden font-normal"
        onClick={() => (open ? closePanel() : openPanel())}
      >
        <span className={cn('truncate', !value && 'text-text-muted')}>
          {value ? selectedLabel ?? 'Selected' : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {allowClear && value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Clear selection"
          onClick={clear}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={(v) => { if (!v) closePanel() }}>
          <DialogContent
            className="fixed inset-x-0 bottom-0 top-auto max-h-[70vh] max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-0 data-[state=open]:slide-in-from-bottom"
            aria-describedby={undefined}
          >
            <DialogHeader className="px-4 pt-4">
              <DialogTitle className="text-base">{ariaLabel}</DialogTitle>
            </DialogHeader>
            {searchField}
            {listBody}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div id={`entity-cb-${listId}`} className={cn('relative', className)}>
      {trigger}
      {open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-lg"
            >
              {searchField}
              {listBody}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
