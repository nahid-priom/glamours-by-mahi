# REPORTS V3 — Duplication Matrix

Goal: zero competing financial engines.

| Metric | Duplicate A (remove/redirect) | Canonical B (keep) | Action |
|---|---|---|---|
| Net / Gross Profit | `reportsRepository.profitReport` | `get_profit_loss_report` via `financialQueries.getProfitLossReport` | Delete A; wire Reports to B |
| P&L UI | Thin KPI cards on `/reports/profit` | `SimpleProfitLossPage` | Share component tree |
| Customer due list | `reportsRepository.customerDueReport` | `listCustomerDues` / `customers.current_due` | Prefer accounting helpers; same field |
| Supplier due list | `reportsRepository.supplierDueReport` | `listSupplierDues` | Same |
| Aging | None on reports | `get_party_due_aging` | Reuse RPC |
| Cash book | None under reports | `listTransactions` / `/accounts/transactions` | Redirect `/reports/cash-book` |
| Sales register | `reportsRepository.salesReport` | Completed `sales` (also sales history) | Keep as ops register; do not invent FT-based sales |
| IndexedDB sales hub | `reporting.service` + `SalesReportsHubPage` | Live `/reports/*` | Leave unmounted; retarget dead links |
| Mock OMS reports | `reports.service` + `/print/reports/:type` | Live report CSV/print | Deprecate mock print for ERP |
| Journals GL | N/A under reports | Optional journals; FT cash-book primary | Do not fabricate journals |

## Forbidden

- Second P&L formula in repository or UI
- Report-only copy of `financial_transactions`
- Overwriting `current_due` from a report page
- Treating courier return requests as posted sale returns
