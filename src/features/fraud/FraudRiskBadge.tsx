import type { FraudLevel } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { getFraudBadgeVariant } from './fraud.service'

interface FraudRiskBadgeProps {
  level: FraudLevel
  score?: number
  className?: string
}

export function FraudRiskBadge({ level, score, className }: FraudRiskBadgeProps) {
  return (
    <Badge variant={getFraudBadgeVariant(level)} className={className}>
      {level}
      {score !== undefined && ` (${score})`}
    </Badge>
  )
}
