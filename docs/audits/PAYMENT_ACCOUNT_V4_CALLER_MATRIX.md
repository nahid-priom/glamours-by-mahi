# PAYMENT ACCOUNT V4 — Caller Matrix

| Route / area | Component | Selection | Kind | Scope | Visible | Missing | Posting | Server | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| /purchases/payments | SupplierPaymentsPage | Method resolve | Via method | activeBranch | Yes | Block | pay supplier RPC | Existing | Resolver unit | Done |
| /sales/collections | DueCollectionPage | Method resolve | Via method | activeBranch | Yes | Block | collect RPC | Existing | Resolver unit | Done |
| Sale collect dialog | CollectDueDialog | Method resolve | Via method | sale.branch | Yes | Block | collect RPC | Existing | — | Done |
| /accounts/customer-due | CustomerDuePage | Method resolve | Via method | activeBranch | Yes | Block | collect RPC | Existing | — | Done |
| /accounts/supplier-due | SupplierDuePage | Method resolve | Via method | activeBranch | Yes | Block | pay RPC | Existing | — | Done |
| /accounts/dues | DueManagementPage | Method resolve | Via method | activeBranch | Yes | Block | collect/pay | Existing | — | Done |
| /purchases/new | PurchaseNewPage | Method resolve if pay>0 | Via method | activeBranch | Yes | Block if pay | complete_purchase | Existing | — | Done |
| /sales/pos | PosPage | Account-first | From FA kind | POS branch | Yes | Block due/paid paths | complete_pos_sale | Existing | — | Fixed V4 |
| /accounts/income | SimpleIncomePage | Explicit FA | Any active | activeBranch | Yes | Block | create_income | Existing | — | Fixed V4 |
| /accounts/expenses | SimpleExpensePage | Explicit FA | Any active | activeBranch | Yes | Block | create_expense | Existing | — | Fixed V4 |
| Purchase returns | PurchaseReturnsPage | Explicit FA | Cash/Bank | activeBranch | Yes | Block refund | return RPC | Existing | — | Done |
| Exchanges | ExchangeConfirmStep | Explicit FA | Per policy | Org list | Yes | Block | exchange RPC | Existing | — | Keep |
| /couriers/settlements | CourierSettlementsPage | Explicit FA | Any | Org | Yes | Block | settle RPC | Existing | — | Fixed V4 |
| /hr/payroll/:id | PayrollRunDetailPage | Explicit FA | Any | Org | Yes | Block | pay payroll | Existing | — | Done |
| /sales/commissions | SalesCommissionsPage | Explicit FA | Any | Org/branch | Yes | Block | pay commission | Existing | — | Fixed V4 |
| /accounts/cash-bank | CashBankPage | Subject FA | Per op | activeBranch | Yes | Block | deposit/withdraw/transfer | Existing | — | Done |
| /accounts/daily-closing | DailyClosingPage | Explicit cash | cash | activeBranch | Yes | Block | close day | Existing | — | Fixed V4 |
| /sales/:id/edit | SaleEditPage | Explicit FA per money line | Kind-matched | Sale branch | Yes | Block money lines | edit_sale → complete_pos_sale | Assert via POS | — | Fixed V4 |
