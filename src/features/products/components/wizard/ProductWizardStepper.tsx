import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PM, WIZARD_STEPS, type WizardStepId } from '../../lib/product-module-theme'

type Props = {
  current: WizardStepId
  /** When quick-add, skip the variants step in the tracker. */
  skipVariants?: boolean
  onStepClick?: (step: WizardStepId) => void
}

export function ProductWizardStepper({ current, skipVariants, onStepClick }: Props) {
  const steps = skipVariants ? WIZARD_STEPS.filter((s) => s.id !== 'variants') : WIZARD_STEPS
  const currentIndex = steps.findIndex((s) => s.id === current)

  return (
    <ol className="product-module flex flex-wrap items-center gap-2 sm:gap-3">
      {steps.map((step, index) => {
        const done = index < currentIndex
        const active = index === currentIndex
        return (
          <li key={step.id} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={!onStepClick || index > currentIndex}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                'flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm',
                active && PM.stepActive,
                done && PM.stepDone,
                !active && !done && PM.stepIdle,
                onStepClick && index <= currentIndex ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                  active ? 'bg-white/20' : done ? 'bg-white/60' : 'bg-white',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.short}</span>
            </button>
            {index < steps.length - 1 ? (
              <span className="hidden h-px w-4 bg-slate-200 sm:block sm:w-6" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
