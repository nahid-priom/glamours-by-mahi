import { createContext, useContext, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionContextValue {
  openItems: string[]
  toggle: (value: string) => void
  type: 'single' | 'multiple'
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

interface AccordionProps {
  type?: 'single' | 'multiple'
  defaultValue?: string[]
  className?: string
  children: ReactNode
}

export function Accordion({
  type = 'single',
  defaultValue = [],
  className,
  children,
}: AccordionProps) {
  const [openItems, setOpenItems] = useState(defaultValue)

  const toggle = (value: string) => {
    setOpenItems((prev) => {
      if (type === 'multiple') {
        return prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      }
      return prev.includes(value) ? [] : [value]
    })
  }

  return (
    <AccordionContext.Provider value={{ openItems, toggle, type }}>
      <div className={cn('divide-y divide-[#111111]/8 rounded-2xl border border-[#111111]/8 bg-white', className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  value: string
  children: ReactNode
  className?: string
}

export function AccordionItem({ value, children, className }: AccordionItemProps) {
  return <div data-value={value} className={className}>{children}</div>
}

interface AccordionTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

export function AccordionTrigger({ value, children, className }: AccordionTriggerProps) {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error('AccordionTrigger must be used within Accordion')

  const isOpen = ctx.openItems.includes(value)

  return (
    <button
      type="button"
      onClick={() => ctx.toggle(value)}
      className={cn(
        'flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold text-[#111111] transition hover:bg-[#F8F6F2]/60 sm:px-5',
        className,
      )}
      aria-expanded={isOpen}
    >
      <span>{children}</span>
      <ChevronDown
        className={cn('h-4 w-4 shrink-0 text-[#6B7280] transition-transform', isOpen && 'rotate-180')}
      />
    </button>
  )
}

interface AccordionContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function AccordionContent({ value, children, className }: AccordionContentProps) {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error('AccordionContent must be used within Accordion')

  if (!ctx.openItems.includes(value)) return null

  return (
    <div className={cn('px-4 pb-4 text-sm leading-relaxed text-[#6B7280] sm:px-5', className)}>
      {children}
    </div>
  )
}
