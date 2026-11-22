# PAYMENT ACCOUNT V4 — Caller Matrix

| Route / area | Component | Selection | Kind | Scope | Visible | Missing | Posting | Server | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| /purchases/payments | SupplierPaymentsPage | Method resolve | Via method | activeBranch | Yes + Summary | Block | pay_supplier | Assert 00161 | Resolver unit | Done |
| /sales/collections | DueCollectionPage | Method resolve | Via method | activeBranch | Yes | Block | collect_customer_due | Assert 00161 | Resolver unit | Done |
| Sale collect dialog | CollectDueDialog | Method resolve | Via method | sale.branch | Yes | Block | collect_customer_due | Assert 00161 | — | Done |
| /accounts/customer-due | CustomerDuePage | Method resolve | Via method | activeBranch | Yes | Block | collect_customer_due | Assert 00161 | — | Done |
| /accounts/supplier-due | SupplierDuePage | Method resolve | Via method | activeBranch | Yes | Block | pay_supplier | Assert 00161 | — | Done |
| /accounts/dues | DueManagementPage | Method resolve | Via method | activeBranch | Yes + Summary | Block | collect/pay | Assert 00161 | — | Done |
| /purchases/new | PurchaseNewPage | Method resolve if pay>0 | Via method | activeBranch | Yes | Block if pay | complete_purchase | Existing | — | Done |
| /sales/pos | PosPage | Account-first | From FA kind | POS branch | Yes | Block | complete_pos_sale | Assert 00160 | — | Done |
| /accounts/income | SimpleIncomePage | Shared select | Any active | activeBranch | Yes | Block | create_income | Existing | — | Done |
| /accounts/expenses | SimpleExpensePage | Shared select | Any active | activeBranch | Yes | Block | create_expense | Existing | — | Done |
| Purchase returns | PurchaseReturnsPage | Shared select | Cash/Bank | activeBranch | Yes | Block refund | return RPC | Existing | — | Done |
| Exchanges | ExchangeConfirmStep | Shared select | Per policy | Org list | Yes | Block | exchange RPC | Existing | — | Done |
| /couriers/settlements | CourierSettlementsPage | Shared select | Any | Org | Yes | Block | settle RPC | Existing | — | Done |
| /hr/payroll/:id | PayrollRunDetailPage | Shared select | Any | Org | Yes | Block | pay payroll | Existing | — | Done |
| /sales/commissions | SalesCommissionsPage | Shared select | Any | Org/branch | Yes | Block | pay commission | Existing | — | Done |
| /accounts/cash-bank | CashBankPage | Shared select | Per op | activeBranch | Yes | Block | deposit/withdraw/transfer | Existing | — | Done |
| /accounts/daily-closing | DailyClosingPage | Shared select | cash | activeBranch | Yes | Block | close day | Existing | — | Done |
| /sales/:id/edit | SaleEditPage | Shared select per money line | Kind-matched | Sale branch | Yes | Block money lines | edit_sale → complete_pos_sale | Assert 00160 | — | Done |
