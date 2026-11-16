# Route Audit — Complete Test-Brief for Glamorous Gallery By Mahi

**Purpose:** Authoritative inventory of every registered React Router route so another model (e.g. ChatGPT) can generate a full manual / E2E / RBAC test guide without re-auditing the codebase.

**Source of truth (code):**
- Router composition: `src/app/routes/index.tsx`
- Guards: `src/app/guards/AdminAuthGuard.tsx`, `src/app/guards/PermissionRoute.tsx`
- Domain route modules: `src/app/routes/*.routes.tsx`
- Smoke registration tests: `src/app/routes/routes.smoke.test.ts`

**App shells:**
| Shell | Guard | Layout |
|-------|-------|--------|
| Public storefront | None | `StorefrontLayout` |
| Public invoice | Token in URL | Standalone page |
| Admin login | None | Standalone |
| Admin ERP | `AdminAuthGuard` (session + active profile) | `DashboardLayout` |
| Print | `AdminAuthGuard` + permission | `PrintLayout` |
| Catch-all `*` | None | `NotFoundPage` |

**PermissionRoute behavior:** If user lacks required permission(s), redirect to `/dashboard` (default fallback). Module-based check uses `hasAnyModuleAccess`. Array permission = **any-of** (`hasPermission`).

**Auth failure behavior:** No session → `/admin/login` with `state.from`. Inactive profile → `/admin/login` with `reason=inactive`. Missing profile → blocking message (no redirect).

---

## How to use this brief (instructions for ChatGPT)

When generating a test guide from this document:

1. Produce one test case per **Primary route** (not redirects), plus dedicated RBAC cases for each permission gate.
2. For each route include: Happy path, Empty state, Error/denied, Permission matrix (allowed vs denied role), Mobile + desktop smoke.
3. Expand **URL query params** into filter/pagination/sort cases where listed.
4. Treat **Redirect routes** as assert-only (URL becomes canonical destination; no unique page UI).
5. Prefer roles: Super Admin / Owner, Admin, Accountant, Branch Manager, Cashier/POS, Moderator, Staff salesperson, HR-only, Website editor, unauthenticated customer.
6. Mark cross-module flows (POS → inventory, purchase → stock, product create → inventory overview) as integration scenarios, not just page loads.
7. Do **not** invent routes not listed here. Prefer linking to this file’s IDs (e.g. `INV-STOCK`).

---

## A. Public / unauthenticated

| ID | Path | Page | Auth | Notes / test focus |
|----|------|------|------|--------------------|
| PUB-HOME | `/` | HomePage | Public | Hero, categories, CTA to shop |
| PUB-SHOP | `/shop` | ShopPage | Public | Catalog browse, filters, pagination |
| PUB-CAT | `/category/:slug` | CategoryPage | Public | Invalid slug empty/404 UX |
| PUB-PDP | `/product/:slug` | ProductDetailsPage | Public | Variants, add to cart, images |
| PUB-CART | `/cart` | CartPage | Public | Empty cart, qty update, checkout CTA |
| PUB-CHECKOUT | `/checkout` | CheckoutPage | Public | Validation, place order |
| PUB-SUCCESS | `/order-success/:orderId` | OrderSuccessPage | Public | Success messaging, track link |
| PUB-TRACK | `/track-order` | TrackOrderPage | Public | Lookup by order/token |
| PUB-SEARCH | `/search` | SearchPage | Public | Query param search |
| PUB-OFFLINE | `/offline` | OfflineFallbackPage | Public | PWA offline fallback |
| PUB-ACCT | `/account` | AccountOverviewPage | Storefront account | Nested under AccountPage |
| PUB-ACCT-ORD | `/account/orders` | AccountOrdersPage | Storefront account | Order history |
| PUB-ACCT-PROF | `/account/profile` | AccountProfilePage | Storefront account | Profile edit |
| PUB-ACCT-WISH | `/account/wishlist` | AccountWishlistPage | Storefront account | Wishlist |
| PUB-ACCT-ADDR | `/account/addresses` | AccountAddressesPage | Storefront account | Address CRUD |
| PUB-INVOICE | `/public/invoice/:secureToken` | PublicInvoicePage | Tokenized public | Invalid token error; no staff session |

---

## B. Auth entry

| ID | Path | Page | Auth | Notes |
|----|------|------|------|-------|
| AUTH-LOGIN | `/admin/login` | AdminLoginPage | Public | Valid login → intended `from`; inactive user blocked; bad credentials |

---

## C. Dashboard

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| DASH | `/dashboard` | DashboardPage | module `dashboard` | KPIs, branch filter, date range, deep links |

---

## D. Sales & POS

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| SALE-POS | `/sales/pos` | PosPage | `pos.create` | Scan barcode (registry+normalize), cart, hold, checkout, branch |
| SALE-NEW | `/sales/new` | → `/sales/pos` | redirect | Assert redirect only |
| SALE-HELD | `/sales/held` | HeldSalesPage | `pos.create` | Resume/delete held sales |
| SALE-ONLINE | `/sales/online-orders` | OnlineOrdersPage | `orders.read` | List/filter statuses |
| SALE-ONLINE-APPR | `/sales/online-orders/:id/approve` | ApproveOnlineOrderPage | `orders.approve` **or** `orders.fulfil` | Approve/fulfil stock impact |
| SALE-EXCH | `/sales/exchanges` | ExchangesPage | `exchange.read` **or** `exchange.create` | List exchanges |
| SALE-EXCH-NEW | `/sales/exchanges/new` | ExchangeCreatePage | `exchange.create` | Create exchange |
| SALE-HIST | `/sales` | SalesHistoryPage | `sales.read` | Filters, pagination, open detail |
| SALE-RETS | `/sales/returns` | SalesReturnsPage | `sales.read` | Return list |
| SALE-COLL | `/sales/collections` | DueCollectionPage | `sales.read` | Due collection |
| SALE-DET | `/sales/:id` | SaleDetailPage | `sales.read` | Detail, print links |
| SALE-EDIT | `/sales/:id/edit` | SaleEditPage | `sales.update` **or** `sales.correct` | Edit/correct |
| SALE-RET | `/sales/:id/return` | SaleReturnPage | `sales.return` **or** `sales.return.review` | Process return → inventory |
| SALE-COLL-ID | `/sales/:id/collections` | DueCollectionPage | `sales.read` | Sale-scoped collection |
| SALE-COMM | `/sales/commissions` | → `/hr/commissions` | `sales.commission.read` | Redirect |
| SALE-COMM-SET | `/sales/commission-settings` | → `/hr/commission-settings` | `sales.commission.manage` | Redirect |
| ORD-* | `/orders`, `/orders/new`, `/orders/*` | → sales/pos | redirect | Legacy aliases |

**Cross-module after POS sale:** Inventory overview KPIs/balances refresh; product stock drops for sold variant/branch.

---

## E. Moderator

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| MOD-DASH | `/moderator` | ModeratorDashboardPage | `moderator.dashboard.read` | Moderator KPIs |
| MOD-ORD-NEW | `/moderator/orders/new` | ModeratorOrderWorkspacePage | `moderator.order.create` | Create moderated order |

Parent group also allows entry if any of: `moderator.dashboard.read`, `moderator.order.create`, `moderator.order.read_own`.

---

## F. Staff workspace

Parent gate (any of): `staff.dashboard.read`, `moderator.dashboard.read`, `staff.sales.read_own`, `sales.read`.

| ID | Path | Page | Notes |
|----|------|------|-------|
| STAFF | `/staff` | → `/staff/dashboard` | Redirect |
| STAFF-DASH | `/staff/dashboard` | StaffDashboardPage | Own performance |
| STAFF-SALES | `/staff/my-sales` | StaffMySalesPage | Own sales only |
| STAFF-ORD | `/staff/my-orders` | StaffMyOrdersPage | Own orders |
| STAFF-COMM | `/staff/my-commission` | StaffMyCommissionPage | Own commission |
| STAFF-TGT | `/staff/my-targets` | StaffMyTargetsPage | Targets |
| STAFF-CUST | `/staff/my-customers` | StaffMyCustomersPage | Assigned customers |
| STAFF-FU | `/staff/follow-ups` | StaffFollowUpsPage | Follow-ups |
| STAFF-PROF | `/staff/profile` | StaffProfilePage | Profile |

---

## G. Products (Product Management 360)

Gate: `products.read`.

| ID | Path | Page | Notes |
|----|------|------|-------|
| PRD-LIST | `/products` | AdminProductsPage | Filters: category, brand, status, stock_status, search, page; KPIs; barcode print; archive/delete |
| PRD-CAT | `/products/categories` | CategoriesPage | CRUD categories |
| PRD-SUB | `/products/subcategories` | SubcategoriesPage | CRUD subcategories |
| PRD-BRAND | `/products/brands` | BrandsPage | CRUD brands |
| PRD-VAR | `/products/variants` | VariantsPage | Variant list |
| PRD-IMP | `/products/import` | ProductImportPage | Bulk CSV import |
| PRD-NEW | `/products/new` | ProductNewPage | Wizard: Quick/Variant/Bulk; opening stock; zero-stock seed → inventory |
| PRD-EDIT | `/products/:id/edit` | ProductEditPage | Edit wizard |
| PRD-DET | `/products/:id` | ProductDetailRedirectPage | Redirect/legacy detail |

**Suggested product filter query params (catalog):** category, brand, status, stock_status, search/`q`, page (see `product-filters.ts`).

**Integration:** Create simple + variant with opening 0 and with opening >0; verify Inventory Overview Out of Stock / In Stock; barcode registry search in POS and inventory `q`.

---

## H. Inventory Overview 360

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| INV | `/inventory` | → `/inventory/stock` | `inventory.read` | Redirect |
| INV-STOCK | `/inventory/stock` | StockOverviewPage | `inventory.read` | **Primary overview** — see query params below |
| INV-BRANCH | `/inventory/branch-stock` | → `/inventory/stock` | redirect | Legacy |
| INV-LEDGER | `/inventory/ledger` | StockLedgerPage | `inventory.read` | Movement ledger filters |
| INV-LOW | `/inventory/low-stock` | LowStockPage | `inventory.read` | Server-side low stock (branch-scoped page) |
| INV-ADJ | `/inventory/adjustments` | StockAdjustmentPage | `inventory.adjust` | Adjust → balances/ledger |
| INV-XFER | `/inventory/transfers` | StockTransferPage | `inventory.transfer` | List/dispatch/receive |
| INV-XFER-NEW | `/inventory/transfers/new` | TransferFormPage | `inventory.transfer` | Create transfer |

### INV-STOCK URL contract (must test)

| Param | Meaning | Views affected |
|-------|---------|----------------|
| `view` | `branches` \| `products` \| `variants` \| `low-stock` (default branches) | All |
| `branch` | branch UUID or `all` | All filtered RPCs |
| `q` | search (name/sku/barcode/registry) | products/variants/low/KPIs |
| `status` | `in_stock` \| `low_stock` \| `out_of_stock` \| `negative_stock` \| `in_transit` \| `damaged` \| `quarantine` | View-aware; branch view disables extended status |
| `category` | category UUID | products/variants/low/KPIs |
| `brand` | brand UUID | products/variants/low/KPIs |
| `damaged` | `1` include damaged locations | includeNonSaleable |
| `quarantine` | `1` include quarantine | includeNonSaleable |
| `sort` | `stock_value` \| `quantity` \| `product_name` \| `purchase_cost` \| `profit` | products |
| `sortDir` | `asc` \| `desc` | products |
| `page` | pagination | products/variants/low-stock |
| `location` | location UUID (URL-supported; weak UI) | RPCs |

**INV-STOCK critical scenarios:**
1. Branch Summary → View Stock preserves `branch` + `view=products`.
2. Export CSV: Current page vs All filtered; cost columns only with `inventory.valuation` / `accounting.view` / `products.manage_prices`.
3. Low stock > 2000 balances still paginates correctly (server RPC).
4. Zero-stock products appear under Out of Stock when seeded/eligible.
5. KPI unique product/variant counts ≠ sum of branch listing counts.
6. After purchase receive / POS sale / adjust / transfer / return: values refresh (query invalidation).

---

## I. Purchases

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| PUR-LIST | `/purchases` | PurchaseHistoryPage | `purchases.read` | List |
| PUR-RET | `/purchases/returns` | PurchaseReturnsPage | `purchases.read` | Returns → stock |
| PUR-PAY | `/purchases/payments` | SupplierPaymentsPage | `purchases.read` | Payments |
| PUR-DET | `/purchases/:id` | PurchaseDetailPage | `purchases.read` | Detail |
| PUR-NEW | `/purchases/new` | PurchaseNewPage | `purchases.create` | Receive stock → inventory WAC |

---

## J. Suppliers

Gate: `suppliers.read`.

| ID | Path | Page | Notes |
|----|------|------|-------|
| SUP-LIST | `/suppliers` | SuppliersPage | List |
| SUP-IMP | `/suppliers/import` | SupplierImportPage | Import |
| SUP-NEW | `/suppliers/new` | SuppliersPage | Same list (create UI on page) |
| SUP-DET | `/suppliers/:id` | SupplierDetailPage | Detail |
| SUP-EDIT | `/suppliers/:id/edit` | SupplierDetailPage | Edit mode |
| SUP-LED | `/suppliers/:id/ledger` | SupplierDetailPage | Ledger tab |

---

## K. Customers

Gate: `customers.read`.

| ID | Path | Page | Notes |
|----|------|------|-------|
| CUS-LIST | `/customers` | CustomersAdminPage | List |
| CUS-IMP | `/customers/import` | CustomerImportPage | Import |
| CUS-NEW | `/customers/new` | CustomersAdminPage | Create on list |
| CUS-DET | `/customers/:id` | CustomerDetailPage | Detail |
| CUS-EDIT | `/customers/:id/edit` | CustomerDetailPage | Edit |
| CUS-LED | `/customers/:id/ledger` | CustomerDetailPage | Ledger |

---

## L. Couriers

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| CR-LIST | `/couriers` | CourierCompaniesPage | `courier.read` | Companies |
| CR-TRACK | `/couriers/tracking` | DeliveryTrackingPage | `courier.read` | Tracking |
| CR-SETL | `/couriers/settlements` | CourierSettlementsPage | `courier.read` | Settlements |
| CR-DET | `/couriers/:id` | CourierCompaniesPage | `courier.read` | Company detail via same page |
| CR-PARCEL | `/couriers/parcels` | ParcelBookingPage | `courier.manage` **or** `courier.book` | Book parcel |
| CR-RET | `/couriers/returns` | ReturnRequestsPage | `sales.return.review` | Courier returns |

---

## M. Accounts

Gate: `accounts.read`.

| ID | Path | Page | Notes |
|----|------|------|-------|
| ACC-DASH | `/accounts` | AccountsDashboardPage | Hub |
| ACC-CASH | `/accounts/cash-bank` | CashBankPage | Cash/bank |
| ACC-INC | `/accounts/income` | IncomePage | Income |
| ACC-EXP | `/accounts/expenses` | ExpensesPage | Expenses |
| ACC-CDUE | `/accounts/customer-due` | CustomerDuePage | Customer due |
| ACC-SDUE | `/accounts/supplier-due` | SupplierDuePage | Supplier due |
| ACC-COLL | `/accounts/collections` | DueCollectionPage | Collections |
| ACC-SPAY | `/accounts/supplier-payments` | SupplierPaymentsPage | Supplier payments |
| ACC-CLOSE | `/accounts/daily-closing` | DailyClosingPage | Daily close |
| ACC-TXN | `/accounts/transactions` | TransactionsPage | Transactions |
| ACC-PL | `/accounts/profit-loss` | ProfitLossPage | P&L |
| ACC-RECON | `/accounts/reconciliation` | ReconciliationCenterPage | Reconciliation |
| ACC-SET | `/accounts/settings` | AccountSettingsPage | Settings |

**Account redirects (assert destination only):**  
`/accounts/chart`→settings · `journals|general-ledger|cash-flow`→transactions · `trial-balance|balance-sheet`→profit-loss · `setup`→settings · `customer-ledger|customer-dues`→customer-due · `supplier-ledger|supplier-dues`→supplier-due · `cashbook|banks|mobile-banking`→cash-bank

---

## N. HR & commissions

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| HR | `/hr` | → `/hr/employees` | redirect | |
| HR-EMP | `/hr/employees` | HrEmployeesPage | `hr.read` **or** create/update | List |
| HR-EMP-NEW | `/hr/employees/new` | HrEmployeeCreatePage | same | Create |
| HR-EMP-DET | `/hr/employees/:id` | HrEmployeeDetailPage | same | Detail |
| HR-ATT | `/hr/attendance` | HrAttendancePage | attendance read/manage/self | Attendance |
| HR-LEAVE | `/hr/leaves` | HrLeavesPage | leave read/approve | Leaves |
| HR-PAY | `/hr/payroll` | HrPayrollPage | payroll.* family | Runs list |
| HR-PAY-NEW | `/hr/payroll/new` | HrPayrollNewPage | payroll.* | New run |
| HR-PAY-DET | `/hr/payroll/:id` | HrPayrollRunDetailPage | payroll.* | Detail |
| HR-PAY-REV | `/hr/payroll/:id/review` | HrPayrollRunDetailPage | payroll.* | Review |
| HR-PAY-PAY | `/hr/payroll/:id/payments` | HrPayrollRunDetailPage | payroll.* | Payments |
| HR-SAL | `/hr/payroll/salary-structures` | HrSalaryStructuresPage | payroll.* | Structures |
| HR-ADV | `/hr/payroll/advances` | HrPayrollAdvancesPage | payroll.* | Advances |
| HR-PREP | `/hr/payroll/reports` | HrPayrollReportsPage | payroll.* | Reports |
| HR-SLIP | `/hr/payslips/:payrollItemId` | HrPayslipPage | payroll.* | Payslip |
| HR-COMM | `/hr/commissions` | SalesCommissionsPage | `sales.commission.read` | Commissions |
| HR-COMM-SET | `/hr/commission-settings` | CommissionSettingsPage | `sales.commission.manage` | Settings |

---

## O. Reports

Gate: `reports.read`.

| ID | Path | Page | Notes |
|----|------|------|-------|
| REP-HUB | `/reports` | ReportsHubPage | Hub |
| REP-SALES | `/reports/sales` | SalesReportPage | Sales |
| REP-PUR | `/reports/purchases` | PurchasesReportPage | Purchases |
| REP-INV | `/reports/inventory` | InventoryReportPage | Inventory |
| REP-CDUE | `/reports/customer-due` | CustomerDueReportPage | Customer due |
| REP-TOP | `/reports/top-customers` | TopCustomersReportPage | Top customers |
| REP-SDUE | `/reports/supplier-due` | SupplierDueReportPage | Supplier due |
| REP-PROF | `/reports/profit` | ProfitReportPage | Profit |
| REP-BR | `/reports/branch` | BranchReportPage | Branch |
| REP-SP | `/reports/salesperson` | SalespersonReportPage | Salesperson |
| REP-PP | `/reports/product-performance` | ProductPerformanceReportPage | Product performance |
| REP-CR | `/reports/courier` | CourierReportPage | Courier |
| REP-CRR | `/reports/courier-returns` | CourierReturnsReportPage | Courier returns |

**Redirects:** `/reports/products`→product-performance · `/reports/branches`→branch · `/reports/accounts`→`/accounts/profit-loss` · `/reports/hr`→`/hr/payroll`

---

## P. Administration

Parent gate (any of): `administration.read`, `administration.users.read`, `settings.manage`.

| ID | Path | Page | Nested permission | Notes |
|----|------|------|-------------------|-------|
| ADM-HUB | `/administration` | AdministrationHubPage | parent | Hub |
| ADM-USERS | `/administration/users` | AdminUsersListPage | users.read **or** settings.manage | Users |
| ADM-USER-NEW | `/administration/users/new` | AdminUserInvitePage | users.create **or** settings.manage | Invite |
| ADM-USER-DET | `/administration/users/:id` | AdminUserDetailPage | users.read **or** settings.manage | Detail/branches |
| ADM-ROLES | `/administration/roles` | AdminRolesPage | roles.manage **or** settings.manage | Roles |
| ADM-PERM | `/administration/permissions` | AdminPermissionsPage | permissions.read **or** settings.manage | Permissions matrix |
| ADM-ACT | `/administration/activity` | ActivityLogsPage | activity.read **or** audit.read | Activity |
| ADM-TGT | `/administration/targets` | AdminTargetsPage | staff.targets.manage **or** settings.manage | Targets |

---

## Q. Settings / website / stores

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| SET | `/settings` | SettingsPage | `settings.manage` | Org settings |
| SET-ACT | `/activity-logs` | → `/administration/activity` | audit.read **or** activity.read | Redirect |
| SET-WEB | `/settings/website` | WebsiteSettingsPage | website.* **or** settings.manage | Website hub |
| SET-WEB-HOME | `/settings/website/homepage` | WebsiteHomepageTabPage | same | Homepage |
| SET-WEB-SEO | `/settings/website/seo` | WebsiteSeoTabPage | same | SEO |
| SET-WEB-SOC | `/settings/website/social` | WebsiteSocialTabPage | same | Social |
| SET-WEB-CON | `/settings/website/contact` | WebsiteContactTabPage | same | Contact |
| SET-HERO-NEW | `/settings/website/hero/new` | HeroSlideEditorPage | same | New hero |
| SET-HERO-EDIT | `/settings/website/hero/:id` | HeroSlideEditorPage | same | Edit hero |
| SET-HERO-PREV | `/settings/website/hero/:id/preview` | HeroSlidePreviewPage | same | Preview |
| SET-RESET | `/settings/data-reset` | DataResetSettingsPage | `settings.data_reset` | Destructive reset — extra confirm |
| STORES | `/stores` | StoresPage | stores.read **or** manage **or** settings.manage | Branches/stores |

---

## R. Print (authenticated)

Parent: `/print` + `AdminAuthGuard` + `PrintLayout`.

| ID | Path | Page | Permission | Notes |
|----|------|------|------------|-------|
| PRT-SALE-A4 | `/print/sales/:id/a4` | PrintSaleA4Page | `sales.read` | A4 invoice |
| PRT-SALE-POS | `/print/sales/:id/pos` | PrintSalePosPage | `sales.read` | POS receipt |
| PRT-SALE-GIFT | `/print/sales/:id/gift-label` | PrintSaleGiftLabelPage | `sales.read` | Gift label |
| PRT-SALE-REP | `/print/sales/report` | PrintSalesReportPage | `sales.read` | Sales report print |
| PRT-PUR-A4 | `/print/purchases/:id/a4` | PrintPurchaseA4Page | `purchases.read` | Purchase A4 |
| PRT-EXCH | `/print/exchanges/:id` | PrintExchangeReceiptPage | `exchange.read` | Exchange receipt |
| PRT-REP | `/print/reports/:reportType` | PrintReportPage | `reports.read` **or** `reports.print` | Generic report print |
| PRT-ORD | `/print/orders/*` | → `/sales` | redirect | Legacy |

---

## S. Catch-all

| ID | Path | Page | Notes |
|----|------|------|-------|
| NF | `*` | NotFoundPage | Unknown URL; link back to home/dashboard |

---

## Global test dimensions (apply to every Primary route)

1. **Auth**
   - Logged out → admin routes redirect `/admin/login`
   - Logged in inactive → login with reason
   - Missing profile → blocking message
2. **RBAC**
   - Role **with** permission: page loads, primary actions enabled
   - Role **without** permission: redirect `/dashboard` (or nested gate blocks)
3. **Branch isolation**
   - Restricted branch user cannot see other-branch stock/sales where RLS applies
4. **Loading / empty / error**
   - Skeleton or loader; empty state; failed fetch messaging
5. **Responsive**
   - 360 / 768 / 1024 / 1440 smoke for layout breakage
6. **Navigation**
   - Sidebar/deep link lands on correct route; breadcrumbs if present
7. **Print / export**
   - Where buttons exist: opens correct print route or downloads CSV with permission masking

---

## Priority smoke pack (minimum release)

1. AUTH-LOGIN → DASH  
2. SALE-POS (barcode + complete sale) → INV-STOCK refresh  
3. PRD-NEW (simple + variant, zero & non-zero opening) → INV-STOCK out/in stock  
4. PUR-NEW receive → INV-STOCK qty/cost  
5. INV-STOCK all four views + filters + export page/all  
6. INV-ADJ + INV-XFER-NEW dispatch/receive  
7. SALE-RET return path  
8. CUS-LIST / SUP-LIST / ACC-DASH / REP-HUB load  
9. ADM-USERS invite + role permission deny  
10. PUB-HOME → PUB-PDP → PUB-CART → PUB-CHECKOUT  
11. PUB-INVOICE valid/invalid token  
12. SET-RESET denied for non-privileged role  

---

## Route counts (approximate)

| Area | Primary pages | Redirects |
|------|---------------|-----------|
| Public storefront + invoice | ~16 | 0 |
| Auth | 1 | 0 |
| Dashboard | 1 | 0 |
| Sales/POS | ~14 | ~6 |
| Moderator | 2 | 0 |
| Staff | 8 | 1 |
| Products | 9 | 0 |
| Inventory | 6 | 2 |
| Purchases | 5 | 0 |
| Suppliers | 6 | 0 |
| Customers | 6 | 0 |
| Couriers | 6 | 0 |
| Accounts | 13 | ~14 |
| HR | 16 | 1 |
| Reports | 13 | 4 |
| Administration | 8 | 0 |
| Settings/Stores | 11 | 1 |
| Print | 7 | 1 |
| Not found | 1 | 0 |

---

## File map for maintainers

| Module | Route file |
|--------|------------|
| Composition | `src/app/routes/index.tsx` |
| Storefront | `storefront.routes.tsx` |
| Dashboard | `dashboard.routes.tsx` |
| Sales | `sales.routes.tsx` |
| Moderator | `moderator.routes.tsx` |
| Staff | `staff.routes.tsx` |
| Products | `products.routes.tsx` |
| Inventory | `inventory.routes.tsx` |
| Purchases | `purchases.routes.tsx` |
| Suppliers | `suppliers.routes.tsx` |
| Customers | `customers.routes.tsx` |
| Couriers | `courier.routes.tsx` |
| Accounts | `accounts.routes.tsx` |
| HR | `hr.routes.tsx` |
| Reports | `reports.routes.tsx` |
| Administration | `administration.routes.tsx` |
| Settings | `settings.routes.tsx` |
| Print | `print.routes.tsx` |

---

## Explicit non-claims

- This brief does **not** assert E2E tests were executed.
- Sidebar menu labels may hide routes the user can still deep-link; test deep links separately from nav visibility.
- Some pages share a component for multiple paths (e.g. customer detail/edit/ledger); test each path’s mode/tab.
- `incoming` inventory quantity is currently always 0 by product contract — do not fail inventory tests expecting PO open qty.
