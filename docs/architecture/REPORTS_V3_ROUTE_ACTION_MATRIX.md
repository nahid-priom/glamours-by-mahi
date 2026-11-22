# REPORTS V3 — Route Action Matrix

| Route | Action | Target / Component | Permission |
|---|---|---|---|
| `/reports` | Hub | `ReportsHubPage` (Report Center) | `reports.read` |
| `/reports/sales` | Live | `SalesReportPage` | `reports.read` |
| `/reports/purchases` | Live | `PurchasesReportPage` | `reports.read` |
| `/reports/inventory` | Live | `InventoryReportPage` | `reports.read` |
| `/reports/customer-due` | Live | `CustomerDueReportPage` | `reports.read` |
| `/reports/supplier-due` | Live | `SupplierDueReportPage` | `reports.read` |
| `/reports/top-customers` | Live | `TopCustomersReportPage` | `reports.read` |
| `/reports/profit` | Live shared P&L | `SimpleProfitLossPage` wrapper | `reports.read` + (`accounts.read` \| `profit_loss.read`) |
| `/reports/branch` | Live | `BranchReportPage` | `reports.read` |
| `/reports/salesperson` | Live | `SalespersonReportPage` | `reports.read` |
| `/reports/product-performance` | Live | `ProductPerformanceReportPage` | `reports.read` |
| `/reports/courier` | Live | `CourierReportPage` | `reports.read` |
| `/reports/courier-returns` | Live | `CourierReturnsReportPage` | `reports.read` |
| `/reports/cash-book` | Redirect preserve query | `/accounts/transactions` | outer `reports.read`; Accounts enforces `accounts.read` |
| `/reports/dues` | Redirect preserve query | `/accounts/dues` | same pattern |
| `/reports/products` | Redirect | `/reports/product-performance` | `reports.read` |
| `/reports/branches` | Redirect | `/reports/branch` | `reports.read` |
| `/reports/accounts` | Redirect preserve query | `/accounts/profit-loss` | `reports.read` → Accounts gate |
| `/reports/hr` | Redirect | `/hr/payroll/reports` | `reports.read` → HR gate |

## Dead links (hygiene)

| Old | Replacement |
|---|---|
| `/reports/sales/channels` | `/reports/sales` |
| `/reports/sales/products` | `/reports/product-performance` |
| `/reports/sales/customers` | `/reports/top-customers` |
| `/reports/sales/collections` | `/sales/collections` |
| `/reports/sales/profit` | `/reports/profit` |
| `/reports/sales/returns` | `/reports/sales` (returns note) |
| `/reports/sales/salesperson` | `/reports/salesperson` |
