# REPORTS V3 — Shared Filter Contract

## Typed shape

```ts
type ReportFilterContract = {
  from: string      // YYYY-MM-DD business date (BD calendar)
  to: string
  branchId?: string | null  // null/undefined = all accessible
  warehouseId?: string | null
  customerId?: string | null
  supplierId?: string | null
  productId?: string | null
  salespersonId?: string | null
  status?: string | null
  page?: number
  pageSize?: number
}
```

## Rules

1. Use [`toQueryBounds`](../../src/lib/datetime/bd.ts) for ISO inclusive range (ERP BD timezone).
2. Do not apply a filter the backend cannot honor.
3. Prefer URL query sync for `from`, `to`, `branchId`, `page` where pages support it.
4. Summary KPIs must use the **full** filtered set, not the visible page.
5. Print/CSV must receive the same contract as on-screen.
6. Legacy redirects must preserve `location.search`.
7. Active header branch (`activeBranchId`) scopes financial P&L the same way Accounts does.

## Query keys

Prefer stable keys:

`['reports', reportType, from, to, branchId, ...filters, page, pageSize]`

Financial P&L reuses `financialQueryKeys.profitLossReport`.
