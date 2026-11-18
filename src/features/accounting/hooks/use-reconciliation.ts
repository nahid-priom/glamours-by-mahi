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
  kind: 'stock' | 'parties' | 'financial' | 'partial' | 'supplier360',
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
        case 'supplier360':
          return reconciliationRepository.supplierFinancialDryRun()
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reconciliationReport() })
    },
  })
}

export function useSupplierRepairApply(
  kind: 'opening_sign' | 'party_sync',
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (mode: 'dry_run' | 'apply') => {
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `repair-${Date.now()}`
      if (kind === 'opening_sign') {
        return reconciliationRepository.repairSupplierOpeningSign(mode, key)
      }
      return reconciliationRepository.repairSupplierPartySync(mode, key)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.reconciliationReport() })
    },
  })
}
