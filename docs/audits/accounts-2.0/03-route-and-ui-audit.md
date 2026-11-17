# REPORT 3 — Route & UI Audit (+ Component Reuse)

**Evidence roots:** `src/app/routes/accounts.routes.tsx`, `src/components/layout/AppSidebar.tsx:187-203`, `src/app/routes/lazy.tsx`, `src/features/accounting/**`

## Current sidebar (Accounts)

| Label | Path | Nav permissions |
|---|---|---|
| Accounts Dashboard | `/accounts` | `accounts.read` |
| Cash & Bank | `/accounts/cash-bank` | `accounts.read` |
| Income | `/accounts/income` | `accounts.read`, `income.create` |
| Expenses | `/accounts/expenses` | `accounts.read`, `expense.create` |
| Customer Due | `/accounts/customer-due` | `accounts.read`, `customer_due.collect` |
| Supplier Due | `/accounts/supplier-due` | `accounts.read`, `supplier_due.pay` |
| Due Collection | `/accounts/collections` | `accounts.read`, `customer_due.collect`, `accounts.post` |
| Supplier Payment | `/accounts/supplier-payments` | `accounts.read`, `supplier_due.pay`, `accounts.post` |
| Daily Closing | `/accounts/daily-closing` | `accounts.read`, `daily_closing.create` |
| Transactions | `/accounts/transactions` | `accounts.read` |
| Profit & Loss | `/accounts/profit-loss` | `accounts.read`, `profit_loss.read` |
| Reconciliation | `/accounts/reconciliation` | recon/manage (sidebar) |
| Account Settings | `/accounts/settings` | `accounts.manage`, `account_settings.manage` |

## Route assessment matrix

| Current path | Page component | Key RPC / data | Classification | Compatibility strategy |
|---|---|---|---|---|
| `/accounts` | `SimpleAccountsDashboardPage` | `getDashboardKpis` | **MERGE INTO** Accounts Management hub | Become overview tab/section of `/accounts/accounts` or keep as hub landing |
| `/accounts/cash-bank` | `CashBankPage` | FA list, income/expense/transfer RPCs | **MERGE INTO** Accounts Management | Primary “My Accounts” surface |
| `/accounts/income` | `SimpleIncomePage` | `create_income`, list income | **RETAIN AS INTERNAL** / tab | Income action from hub |
| `/accounts/expenses` | `SimpleExpensePage` | `create_expense`, void | **RETAIN AS INTERNAL** / tab | Expense action from hub |
| `/accounts/customer-due` | `CustomerDuePage` | list dues, `collect_customer_due` | **MERGE INTO** Due Management | Customer tab |
| `/accounts/supplier-due` | `SupplierDuePage` | list dues, `pay_supplier` | **MERGE INTO** Due Management | Supplier tab |
| `/accounts/collections` | `DueCollectionPage` (sales) | `collect_customer_due` | **REDIRECT** after migration | Prefer `/sales/collections` or `/accounts/dues?tab=collect` |
| `/accounts/supplier-payments` | `SupplierPaymentsPage` (purchases) | `pay_supplier` | **REDIRECT** after migration | Prefer `/purchases/payments` or dues tab |
| `/accounts/daily-closing` | `DailyClosingPage` | `close_business_day` | **RETAIN AS INTERNAL DETAIL** | Action from Accounts Management |
| `/accounts/transactions` | `TransactionsPage` | `financial_transactions` | **KEEP** (mandatory) | Target `/accounts/transactions` stays |
| `/accounts/profit-loss` | `SimpleProfitLossPage` | client `getProfitLoss` | **KEEP** / enhance | Target P&L page |
| `/accounts/reconciliation` | `ReconciliationCenterPage` | recon RPCs | **RETAIN AS INTERNAL** | Settings/tools area |
| `/accounts/settings` | `AccountSettingsPage` | org settings blob | **RETAIN AS INTERNAL** | Account Settings |
| Legacy aliases (`/accounts/chart`, `journals`, `cashbook`, …) | `<Navigate replace>` | n/a | **KEEP redirects** | Already compatibility routes |

### Dual-mount note (VERIFIED)

- `/accounts/collections` and `/sales/collections` share the same lazy page.  
- `/accounts/supplier-payments` and `/purchases/payments` share the same lazy page.  
Quick Actions already prefer sales/purchases paths.

### Permission mismatch (VERIFIED)

Daily Closing **nav** allows `daily_closing.create`, but page submit gate uses `accounts.manage | accounts.post` only (`DailyClosingPage.tsx` ~115). Users with only `daily_closing.create` may see the page but cannot close.

## Proposed target navigation

**Accounts & Finance**

1. **Accounts Management** → compose dashboard + cash/bank + ledger + money actions + links to closing/recon/settings  
2. **Due Management** → customer/supplier tabs + collect/pay  
3. **Profit & Loss** → enhanced analytics façade  
4. **Transactions** → keep as sibling or deep link (do not remove capability)

Candidate final paths (aligned with existing `/accounts` prefix — preferred over inventing `/accounts/accounts` unless product insists):

| Target capability | Recommended path |
|---|---|
| Accounts Management hub | `/accounts` (enhanced) or `/accounts/manage` |
| Account ledger | `/accounts/cash-bank?account=:id` **or** `/accounts/accounts/:id/ledger` (new detail) |
| Transactions | `/accounts/transactions` |
| Due Management | `/accounts/dues` (new façade; redirect old due routes) |
| Profit & Loss | `/accounts/profit-loss` |

## UI/UX gap analysis (Accounts Management)

| Capability | Current | Gap |
|---|---|---|
| Total balance / money in / out | Dashboard KPIs | Exists |
| Cash / bank / mobile lists | CashBank by `account_kind` | Exists |
| Create/edit account | CashBank dialog | Exists |
| Income / expense / transfer | Pages + CashBank dialogs | Deposit/withdraw wrongly use income/expense |
| Account ledger | Transactions filterable by account; `balance_after` | Dedicated ledger page UX thin |
| Daily closing / recon / payment mapping | Separate pages + settings | Need secondary nav, not deletion |
| Search / date / branch | Partial per page | Needs consistent filter bar on hub |

## Component reuse matrix

| Target UI element | Existing component | Path | Reusable? | Required change | Risk |
|---|---|---|---|---|---|
| Accounts Summary KPIs | `KpiCard`, `PageHeader` | `AccountingUi.tsx` | Yes | Compose on hub | Low |
| Account List | CashBank list UI | `CashBankPage.tsx` | Partial | Extract presentational list | Low |
| Ledger Table | Transactions table | `TransactionsPage.tsx` | Partial | Account-scoped view + running balance UX | Med |
| Transaction Details | Inline / limited | accounting pages | Weak | Drawer pattern from invoices | Med |
| Due Table | Customer/Supplier Due tables | `CustomerDuePage`, `SupplierDuePage` | Yes | Tabs wrapper | Low |
| Due Drawer | Dialogs on due pages | same | Partial | Unify with `CollectDueDialog` | Med |
| Collection Form | `CollectDueDialog`, `DueCollectionPage` | sales | Yes | Deduplicate | Med |
| Supplier Pay Form | `SupplierPaymentsPage` + due dialog | purchases / accounting | Yes | Deduplicate | Med |
| P&L KPI | `SimpleProfitLossPage` + `KpiCard` | accounting | Yes | Add charts/drill-down | Med |
| Profit Chart | Dashboard `CashFlowChart` | dashboard | Partial | Wire real series | Med |
| Report Filters | `DateRangeInputs` | `AccountingUi.tsx` | Yes | Branch selector consistency | Low |
| Party picker | `EntityCombobox` | `components/entity-combobox` | Yes | — | Low |
| Payment account resolve | `resolvePaymentAccount` | `lib/payments/resolve-payment-account.ts` | Yes | Already tested | Low |

## Responsive notes

| Breakpoint | Observation | Confidence |
|---|---|---|
| Desktop | Max-width shells (`max-w-3xl`/`lg`) common | VERIFIED |
| Mobile | Simple forms generally stack; tables may horizontal-scroll | INFERRED |
| Dedicated mobile accounts nav | Not found | VERIFIED gap |

## Design references

Approved UI screenshots were **not available as files in-repo** for this audit session; assessment uses the written design specification in the master prompt plus live code. Mark image-level visual verification: **BLOCKED / not performed**.
