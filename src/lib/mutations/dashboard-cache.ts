import type { QueryClient } from '@tanstack/react-query'

/** Invalidate all branch-filtered dashboard overview queries. */
export async function invalidateDashboardCaches(qc: QueryClient) {
  await qc.invalidateQueries({ queryKey: ['dashboard'] })
}
