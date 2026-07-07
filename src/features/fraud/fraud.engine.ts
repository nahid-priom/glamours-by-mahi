import type { FraudLevel } from '@/lib/constants'
import type { FraudRisk } from '@/types'
import type { FraudCheckInput } from './fraud.types'

export function calculateFraudRisk(input: FraudCheckInput): FraudRisk {
  const { customer, cod_amount, has_duplicate_pending } = input
  const reasons: string[] = []
  let score = 0

  if (!customer) {
    return {
      level: 'SAFE',
      score: 15,
      reasons: ['No previous issue — new customer'],
      needs_call_confirmation: false,
    }
  }

  if (customer.is_blacklisted) {
    return {
      level: 'BLOCKED',
      score: 95,
      reasons: ['Customer is blacklisted'],
      needs_call_confirmation: true,
    }
  }

  if (customer.return_rate > 40) {
    score += 35
    reasons.push(`High return rate: ${customer.return_rate}%`)
  }

  if (customer.returned_orders >= 3) {
    score += 30
    reasons.push(`${customer.returned_orders} returned orders`)
  }

  if (has_duplicate_pending) {
    score += 20
    reasons.push('Duplicate pending order detected')
  }

  if (cod_amount > 5000) {
    score += 15
    reasons.push(`High COD amount: ৳${cod_amount.toLocaleString('en-BD')}`)
  }

  if (reasons.length === 0) {
    reasons.push('No previous issue')
  }

  const level = getFraudLevel(score)
  const needs_call_confirmation = level === 'HIGH' || level === 'BLOCKED'

  return { level, score: Math.min(score, 100), reasons, needs_call_confirmation }
}

export function getFraudLevel(score: number): FraudLevel {
  if (score >= 91) return 'BLOCKED'
  if (score >= 61) return 'HIGH'
  if (score >= 31) return 'MEDIUM'
  return 'SAFE'
}

export function getFraudBadgeVariant(level: FraudLevel) {
  switch (level) {
    case 'SAFE':
      return 'success' as const
    case 'MEDIUM':
      return 'warning' as const
    case 'HIGH':
      return 'danger' as const
    case 'BLOCKED':
      return 'blocked' as const
  }
}
