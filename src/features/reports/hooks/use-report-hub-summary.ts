import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import { financialQueries } from '@/features/accounting/lib/financial-queries'
import { getInventoryValuationSummary } from '@/features/inventory/repositories/inventory-valuation.repository'
import { reportsRepository, type ReportRange } from '../repositories/reports.repository'
import { formatBDT } from '@/lib/format'
import type { ReportKpi } from '../components/ReportKPIGrid'

export function useReportHubSummary(range: ReportRange) {
  const { can, activeBranchId, profile } = useAuth()
  const orgId = profile?.organization_id ?? null
  const canPnl = can(['accounts.read', 'profit_loss.read'])
  const canValuation = can(['inventory.valuation', 'products.manage_prices', 'accounts.read'])
  const [refreshedAt, setRefreshedAt] = useState(() => new Date())

  const pnl = useQuery({
    queryKey: ['reports', 'hub', 'pnl', orgId, activeBranchId, range.from, range.to],
    enabled: Boolean(orgId) && canPnl,
    queryFn: () => financialQueries.getProfitLossReport(range.from, range.to, activeBranchId),
  })

  const receivables = useQuery({
    queryKey: ['reports', 'hub', 'receivables', orgId],
    enabled: Boolean(orgId),
    queryFn: () => reportsRepository.customerDueTotal(),
  })

  const payables = useQuery({
    queryKey: ['reports', 'hub', 'payables', orgId],
    enabled: Boolean(orgId),
    queryFn: () => reportsRepository.supplierDueTotal(),
  })

  const inventory = useQuery({
    queryKey: ['reports', 'hub', 'inventory-value', orgId, activeBranchId],
    enabled: Boolean(orgId) && canValuation,
    queryFn: () =>
      getInventoryValuationSummary({
        branchId: activeBranchId ?? undefined,
      }),
  })

  const outstandingCod = useQuery({
    queryKey: ['reports', 'hub', 'cod-outstanding', orgId, range.from, range.to],
    enabled: Boolean(orgId),
    queryFn: () => reportsRepository.outstandingCodSettlementTotal(range),
  })

  const loading =
    (canPnl && pnl.isLoading) ||
    receivables.isLoading ||
    (canValuation && inventory.isLoading)

  const inventoryCost = inventory.data?.total_stock_purchase_cost
  const inventorySell = inventory.data?.total_stock_value

  const kpis: ReportKpi[] = useMemo(
    () => [
      {
        id: 'net-sales',
        label: 'Net Sales',
        value: !canPnl
          ? 'Restricted'
          : pnl.isError
            ? '—'
            : formatBDT(Number(pnl.data?.netSales ?? 0)),
        hint: `${range.from} → ${range.to} · P&L authority`,
        href: '/reports/sales',
        error: canPnl && pnl.isError ? 'Could not load P&L' : null,
      },
      {
        id: 'gross-profit',
        label: 'Gross Profit',
        value: !canPnl
          ? 'Restricted'
          : pnl.isError
            ? '—'
            : formatBDT(Number(pnl.data?.grossProfit ?? 0)),
        hint: 'Period · from P&L authority',
        href: '/reports/profit',
        error: canPnl && pnl.isError ? 'Could not load P&L' : null,
      },
      {
        id: 'receivables',
        label: 'Customer Receivables',
        value: receivables.isError ? '—' : formatBDT(receivables.data ?? 0),
        hint: 'As-of party current_due (not aging)',
        href: '/reports/customer-due',
        asOf: true,
        error: receivables.isError ? 'Could not load dues' : null,
      },
      {
        id: 'inventory',
        label: 'Inventory Value',
        value: !canValuation
          ? 'Restricted'
          : inventory.isError
            ? '—'
            : inventoryCost == null
              ? '—'
              : formatBDT(Number(inventoryCost)),
        hint:
          inventoryCost == null && canValuation && !inventory.isError
            ? 'Cost restricted by valuation policy'
            : 'As-of WAC / purchase cost (not sell value)',
        href: '/reports/inventory-valuation',
        asOf: true,
        error: canValuation && inventory.isError ? 'Could not load valuation' : null,
      },
    ],
    [
      canPnl,
      canValuation,
      pnl.isError,
      pnl.data,
      receivables.isError,
      receivables.data,
      inventory.isError,
      inventoryCost,
      range.from,
      range.to,
    ],
  )

  const secondaryKpis: ReportKpi[] = useMemo(
    () => [
      {
        id: 'payables',
        label: 'Supplier Payables',
        value: payables.isError ? '—' : formatBDT(payables.data ?? 0),
        hint: 'As-of party current_due',
        href: '/reports/supplier-due',
        asOf: true,
        error: payables.isError ? 'Could not load payables' : null,
      },
      {
        id: 'cod',
        label: 'Outstanding COD',
        value: outstandingCod.isError ? '—' : formatBDT(outstandingCod.data ?? 0),
        hint: 'Pending courier settlements (≠ delivered COD)',
        href: '/reports/cod-settlement',
        error: outstandingCod.isError ? 'Could not load COD' : null,
      },
      ...(canValuation && inventorySell != null
        ? [
            {
              id: 'inventory-sell',
              label: 'Inventory sell value',
              value: formatBDT(Number(inventorySell)),
              hint: 'As-of catalog sell × qty (not WAC)',
              href: '/reports/inventory-valuation',
              asOf: true,
            } satisfies ReportKpi,
          ]
        : []),
    ],
    [
      payables.isError,
      payables.data,
      outstandingCod.isError,
      outstandingCod.data,
      canValuation,
      inventorySell,
    ],
  )

  return {
    kpis,
    secondaryKpis,
    loading,
    refreshedAt,
    refetch: async () => {
      await Promise.all([
        canPnl ? pnl.refetch() : Promise.resolve(),
        receivables.refetch(),
        payables.refetch(),
        canValuation ? inventory.refetch() : Promise.resolve(),
        outstandingCod.refetch(),
      ])
      setRefreshedAt(new Date())
    },
  }
}
