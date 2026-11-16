/** Product-module chrome: rose/pink accents aligned with sidebar selected brand. */
export const PM = {
  primary: '#E11D48',
  primaryHover: '#BE123C',
  primarySoft: '#FFF1F2',
  primaryBorder: '#FECDD3',
  primaryMuted: '#F43F5E',
  primaryDeep: '#9F1239',
  ring: 'ring-[#E11D48]/30',
  btn: 'bg-[#E11D48] text-white hover:bg-[#BE123C]',
  btnOutline: 'border-[#E11D48] text-[#E11D48] hover:bg-[#FFF1F2]',
  cardActive: 'border-[#E11D48] bg-[#FFF1F2] shadow-sm ring-2 ring-[#E11D48]/20',
  cardIdle: 'border-border bg-white hover:border-[#FECDD3]',
  stepActive: 'bg-[#E11D48] text-white',
  stepDone: 'bg-[#FECDD3] text-[#9F1239]',
  stepIdle: 'bg-slate-100 text-slate-500',
  chip: 'rounded-full border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-0.5 text-xs font-medium text-[#9F1239]',
} as const

export type ProductEntryMode = 'quick' | 'variant' | 'bulk'

export type WizardStepId = 'info' | 'variants' | 'stock' | 'review'

export const WIZARD_STEPS: Array<{ id: WizardStepId; label: string; short: string }> = [
  { id: 'info', label: 'Product Info', short: 'Info' },
  { id: 'variants', label: 'Variants', short: 'Variants' },
  { id: 'stock', label: 'Pricing & Stock', short: 'Stock' },
  { id: 'review', label: 'Review & Save', short: 'Review' },
]
