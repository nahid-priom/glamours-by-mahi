import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import {
  listFinancialAccounts,
  listPaymentMethods,
  listPosCatalogue,
} from '../repositories/pos.repository'

const PAGE_SIZE = 24

export function usePosCatalogue(branchId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.posProducts(branchId ?? 'none'),
    queryFn: ({ pageParam, signal }) =>
      listPosCatalogue({
        branchId: branchId!,
        cursor: pageParam ?? null,
        pageSize: PAGE_SIZE,
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(branchId),
    staleTime: 30_000,
  })
}

export function usePosPaymentMethods() {
  return useQuery({
    queryKey: queryKeys.posPaymentMethods,
    queryFn: listPaymentMethods,
    staleTime: 60_000,
  })
}

export function usePosFinancialAccounts(branchId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.posFinancialAccounts(branchId ?? 'none'),
    queryFn: () => listFinancialAccounts(branchId),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  })
}
