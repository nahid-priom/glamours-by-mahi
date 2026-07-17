import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { reconciliationRepository } from '../repositories/reconciliation.repository'

export function useReconciliationReport() {
  return useQuery({
    queryKey: queryKeys.reconciliationReport(),
    queryFn: () => reconciliationRepository.getReport(),
  })
}

export function useReconciliationDryRun(
  kind: 'stock' | 'parties' | 'financial' | 'partial',
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      switch (kind) {
        case 'stock':
          return reconciliationRepository.dryRunOpeningStock()
        case 'parties':
          return reconciliationRepository.dryRunOpeningParties()
        case 'financial':
          return reconciliationRepository.dryRunFinancialBalances()
        case 'partial':
          return reconciliationRepository.dryRunPartialSales()
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reconciliationReport() })
    },
  })
}
