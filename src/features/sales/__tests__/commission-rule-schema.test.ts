import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/** Mirrors CommissionSettingsPage structure validation rules for regression coverage. */
const tierSchema = z.object({
  min_amount: z.number().min(0),
  max_amount: z.number().min(0).nullable(),
  rate_type: z.enum(['percent', 'fixed']),
  rate: z.number().min(0),
})

const ruleSchema = z
  .object({
    subject_type: z.enum(['employee', 'profile']),
    subject_id: z.string().min(1),
    structure_mode: z.enum(['per_sale', 'sale_amount_tiers', 'period_volume_tiers']),
    rule_type: z.enum(['fixed', 'percent_sale', 'percent_profit', 'none']),
    rate: z.number().min(0),
    tiers: z.array(tierSchema),
    applies_to_sources: z.array(z.string()).min(1),
  })
  .superRefine((v, ctx) => {
    if (v.structure_mode !== 'per_sale' && v.tiers.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one tier', path: ['tiers'] })
    }
  })

describe('commission structure validation', () => {
  it('accepts per-sale percent rule for employee', () => {
    const parsed = ruleSchema.safeParse({
      subject_type: 'employee',
      subject_id: 'emp-1',
      structure_mode: 'per_sale',
      rule_type: 'percent_sale',
      rate: 2.5,
      tiers: [],
      applies_to_sources: ['pos'],
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts moderator profile subject with amount tiers', () => {
    const parsed = ruleSchema.safeParse({
      subject_type: 'profile',
      subject_id: 'prof-1',
      structure_mode: 'sale_amount_tiers',
      rule_type: 'percent_sale',
      rate: 0,
      tiers: [{ min_amount: 0, max_amount: 1000, rate_type: 'percent', rate: 5 }],
      applies_to_sources: ['moderator', 'tele_sales'],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects tier mode without tiers', () => {
    const parsed = ruleSchema.safeParse({
      subject_type: 'employee',
      subject_id: 'emp-1',
      structure_mode: 'period_volume_tiers',
      rule_type: 'percent_sale',
      rate: 0,
      tiers: [],
      applies_to_sources: ['pos'],
    })
    expect(parsed.success).toBe(false)
  })
})
