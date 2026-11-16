import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateInventoryQueries } from '@/features/inventory/lib/invalidate-inventory-queries'
import { queryKeys } from '@/lib/query/keys'
import {
  approveOnlineOrder,
  cancelOnlineOrder,
  fulfilOnlineOrder,
  listOnlineOrders,
} from '../repositories/online-orders.repository'

export function useOnlineOrders(status?: string) {
  return useQuery({
    queryKey: queryKeys.onlineOrders({ status }),
    queryFn: () => listOnlineOrders({ status }),
  })
}

export function useFulfilOnlineOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => fulfilOnlineOrder(saleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['online-orders'] })
      void qc.invalidateQueries({ queryKey: ['sales'] })
      invalidateInventoryQueries(qc)
    },
  })
}

export function useCancelOnlineOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason?: string }) =>
      cancelOnlineOrder(saleId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['online-orders'] })
    },
  })
}

export function useApproveOnlineOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => approveOnlineOrder({ sale_id: saleId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['online-orders'] })
    },
  })
}
