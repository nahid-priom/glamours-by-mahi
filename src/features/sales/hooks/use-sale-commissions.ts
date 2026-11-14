import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { commissionsRepository } from '../repositories/commissions.repository'

export function useSaleCommissions(saleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.saleCommissionAudit(saleId ?? ''),
    queryFn: () => commissionsRepository.getSaleCommissionAudit(saleId!),
    enabled: Boolean(saleId),
  })
}
