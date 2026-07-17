import { z } from 'zod'
import { isValidBdPhone, normalizeBdPhone } from '@/lib/phone-utils'

/**
 * Shared POS Customer Quick Add validation.
 * Accepts `01712345678`, `8801712345678` and `+8801712345678`, normalizing
 * to the canonical `01XXXXXXXXX` storage format before searching or saving.
 */
export const quickCustomerSchema = z.object({
  mobile: z
    .string()
    .trim()
    .refine(isValidBdPhone, { message: 'সঠিক মোবাইল নম্বর দিন' })
    .transform((value) => normalizeBdPhone(value) ?? value),
  name: z.string().trim().max(120, 'নাম সর্বোচ্চ ১২০ অক্ষর').optional(),
})

export type QuickCustomerForm = z.input<typeof quickCustomerSchema>
export type QuickCustomerValues = z.output<typeof quickCustomerSchema>
