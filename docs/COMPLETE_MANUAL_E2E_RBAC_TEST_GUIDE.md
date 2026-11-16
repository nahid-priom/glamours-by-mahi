# Glamorous Gallery By Mahi — Complete Manual, E2E & RBAC Test Guide

**Source brief:** [ROUTE_AUDIT_TEST_BRIEF.md](./ROUTE_AUDIT_TEST_BRIEF.md)

Prepared from the user-provided “Route Audit — Complete Test-Brief”
Version: 1.0 · Date: 16 November 2026 · Prepared for: Code Bondhu IT

**Status: Test design only. No browser sessions, migrations, permissions, APIs or E2E tests were executed for this guide.**

## Credentials (do not commit secrets)

Use environment variables or a local `.env.test` (gitignored). Never store real passwords in this document or in git.

| Variable | Purpose |
|----------|---------|
| `OWNER_EMAIL` | Super Admin / Owner test account email |
| `OWNER_PASSWORD` | Super Admin / Owner test account password |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin persona (optional) |
| `CASHIER_EMAIL` / `CASHIER_PASSWORD` | Cashier / POS persona (optional) |

Example (local / CI only):

```bash
export OWNER_EMAIL='your-owner@example.com'
export OWNER_PASSWORD='use-a-vault-or-ci-secret'
```

Fixture **OWNER** below authenticates with `OWNER_EMAIL` / `OWNER_PASSWORD`.

---
1. Scope, boundaries and method
- Source is a route-inventory brief, not live verification of the repository. Route names, noted permissions and behaviors come from that brief; all numbered test cases below are proposed acceptance tests.
- One route case for every reported non-redirect primary route. Redirects have separately defined URL-only assertions.
- Each primary case covers happy, empty, error/denied, RBAC, and mobile/desktop checks.
- The upload documents INV-STOCK view=branches|products|variants|low-stock. view=suppliers from the prior requested supplier initiative is planned/not registered in the provided route brief; test it only after implementation.
- Permission arrays use OR (any-of), not AND. Parent and nested gates both apply. Role labels are test personas, not claims about production role grants.
- Use sanctioned test accounts, sanitized test fixtures and non-production environments. Protect customer records, financial data, production data and credentials.
Fixtures & roles
Fixture	Minimum data/setup
OWNER	Active Owner/Super Admin with all required permissions and all branches (`OWNER_EMAIL` / `OWNER_PASSWORD`)
ADMIN	Active Admin with selected permissions
ACCOUNTANT	accounts.read; financial valuation permissions if intentionally granted
BRANCH_MGR	Inventory permissions restricted to Branch A; no access to Branch B
CASHIER	pos.create and selected sales permission, no inventory.valuation
MODERATOR	moderator role with own-order scope
SALES_STAFF	Staff with only own records
HR_ONLY	HR/attendance/payroll scoped grants
WEB_EDITOR	Website editor scope without inventory/financial access
CUSTOMER	Storefront account with own orders and addresses
GUEST	No admin/storefront session
NO_PERM	Authenticated active admin-profile user deliberately missing target permission
INACTIVE	Valid identity with inactive profile
NO_PROFILE	Authenticated user with no linked profile
BRANCH_A / B	At least two branches and independent stock locations
VARIANT_R	Product with two or more sellable variants and barcodes
ZERO_VARIANT	Eligible product/variant with zero available stock
RECEIPT_1 / 2	Two receipts for same variant from distinct suppliers where supported
SALE_1	Sale with known variant/branch and refundable remaining quantity
TOKEN_VALID / INVALID	Public-invoice valid vs invalid/expired test tokens

Global execution protocol
For every admin route: auth guest → /admin/login with state.from, inactive → /admin/login?reason=inactive, missing profile → blocking state. For missing permission: /dashboard or nested restriction. For all primary routes check loading, empty, error/retry and mobile/desktop; when supported, also test keyboard navigation, focus states, browser history, URL deep links and stale data.

Standard dimensions: 360px and 390px mobile, 768px tablet, 1024px compact desktop, 1440px desktop. Individual route cases explicitly require a 390px + 1440px smoke.

Evidence per failure: screenshot or video, reproduction steps, route + query, persona, branch, timestamp, request correlation ID and relevant console/network logs (redacted).
Execution status legend
NOT RUN · PASS · FAIL · BLOCKED · N/A (with reason). Severity P0 stock/security/payment/data loss, P1 workflow broken, P2 UX or minor misbehavior.
A. Public storefront & invoices — primary route tests (16)
TC-PUB-HOME — /
Page: HomePage · Gate/permission: Public (guest); no admin session
Brief note: Hero, categories, CTA to shop  
- HAPPY: Hero, categories and shop CTA navigate to public catalog. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No featured products: page still loads with useful empty content. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Failed hero/catalog query: recoverable message; no broken layout. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-SHOP — /shop
Page: ShopPage · Gate/permission: Public (guest); no admin session
Brief note: Catalog browse, filters, pagination  
- HAPPY: Browse products, apply catalog filters, page through results and open PDP. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No products match search/filter. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid query parameter and failed catalog fetch are handled. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-CAT — /category/:slug
Page: CategoryPage · Gate/permission: Public (guest); no admin session
Brief note: Invalid slug empty/404 UX  
- HAPPY: Valid category slug shows matching products and supports navigation. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Valid category without products has a clear empty state. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown/invalid slug shows 404/empty UX, no cross-category leak. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-PDP — /product/:slug
Page: ProductDetailsPage · Gate/permission: Public (guest); no admin session
Brief note: Variants, add to cart, images  
- HAPPY: View correct variant images, price and availability; add selected variant to cart. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Unavailable/archived variant is not purchasable. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid slug, discontinued product or invalid variant fails safely. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-CART — /cart
Page: CartPage · Gate/permission: Public (guest); no admin session
Brief note: Empty cart, qty update, checkout CTA  
- HAPPY: Add variant; change quantity; remove; proceed to checkout. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Empty cart displays shop CTA. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Out-of-stock item or failed update retains valid state. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-CHECKOUT — /checkout
Page: CheckoutPage · Gate/permission: Public (guest); no admin session
Brief note: Validation, place order  
- HAPPY: Complete valid customer/order form and place one order. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No cart lines: checkout blocked with clear navigation. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Required field errors, payment/stock conflict, retry idempotency. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-SUCCESS — /order-success/:orderId
Page: OrderSuccessPage · Gate/permission: Public (guest); no admin session
Brief note: Success messaging, track link  
- HAPPY: Valid orderId displays correct confirmation and tracking link. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Pending/empty optional order details handled. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown order ID never exposes another customer order. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-TRACK — /track-order
Page: TrackOrderPage · Gate/permission: Public (guest); no admin session
Brief note: Lookup by order/token  
- HAPPY: Valid order/token lookup shows correct status. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Blank lookup prompts for identifier. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid token/order gives non-enumerating failure. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-SEARCH — /search
Page: SearchPage · Gate/permission: Public (guest); no admin session
Brief note: Query param search  
- HAPPY: Query returns matching product variants and correct links. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No matches shows empty-search state. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Malformed q and network failure handled safely. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-OFFLINE — /offline
Page: OfflineFallbackPage · Gate/permission: Public (guest); no admin session
Brief note: PWA offline fallback  
- HAPPY: Simulate offline mode; fallback page shows recovery action. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No cached page still renders fallback. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Reconnect action and offline transitions do not loop. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST (route intentionally public); denied persona: No auth denial required; instead test invalid data and cross-account access where applicable. Assert Public (guest); no admin session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-ACCT — /account
Page: AccountOverviewPage · Gate/permission: Storefront account login; own customer only
Brief note: Nested under AccountPage  
- HAPPY: Authenticated storefront customer sees own account overview. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Account with no orders or wishlist has empty states. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthenticated session gated; no other account data. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: CUSTOMER signed in and scoped to own data; denied persona: GUEST or other CUSTOMER without ownership. Assert Storefront account login; own customer only with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-ACCT-ORD — /account/orders
Page: AccountOrdersPage · Gate/permission: Storefront account login; own customer only
Brief note: Order history  
- HAPPY: Customer sees own order list and opens details. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Account with no orders. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Expired session and foreign order request blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: CUSTOMER signed in and scoped to own data; denied persona: GUEST or other CUSTOMER without ownership. Assert Storefront account login; own customer only with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-ACCT-PROF — /account/profile
Page: AccountProfilePage · Gate/permission: Storefront account login; own customer only
Brief note: Profile edit  
- HAPPY: Display and update allowed account profile fields. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional profile fields absent. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid field or expired session does not overwrite data. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: CUSTOMER signed in and scoped to own data; denied persona: GUEST or other CUSTOMER without ownership. Assert Storefront account login; own customer only with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-ACCT-WISH — /account/wishlist
Page: AccountWishlistPage · Gate/permission: Storefront account login; own customer only
Brief note: Wishlist  
- HAPPY: Add/remove wishlist items and navigate to products. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Empty wishlist. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Removed/unpublished product and expired session handled. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: CUSTOMER signed in and scoped to own data; denied persona: GUEST or other CUSTOMER without ownership. Assert Storefront account login; own customer only with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-ACCT-ADDR — /account/addresses
Page: AccountAddressesPage · Gate/permission: Storefront account login; own customer only
Brief note: Address CRUD  
- HAPPY: Create/edit/delete customer addresses in own account. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No addresses shows add-first CTA. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid address / foreign address ID blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: CUSTOMER signed in and scoped to own data; denied persona: GUEST or other CUSTOMER without ownership. Assert Storefront account login; own customer only with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUB-INVOICE — /public/invoice/:secureToken
Page: PublicInvoicePage · Gate/permission: Valid secure invoice token; no staff session
Brief note: Invalid token error; no staff session  
- HAPPY: Valid secureToken loads correct public invoice without staff login. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional invoice fields missing handled cleanly. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Tampered/expired token reveals no invoice information. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: GUEST holding valid secureToken; denied persona: GUEST with tampered/expired token. Assert Valid secure invoice token; no staff session with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate public responsiveness at 390px and 1440px, keyboard focus and links.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
B. Authentication — primary route tests (1)
TC-AUTH-LOGIN — /admin/login
Page: AdminLoginPage · Gate/permission: Public; active profile required for successful admin login
Brief note: Valid login → intended from; inactive user blocked; bad credentials  
- HAPPY: Valid credentials redirect to original state.from destination. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No saved state.from uses safe default. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Bad credentials, inactive profile, missing profile, rate limits. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Active OWNER/ADMIN valid credentials; denied persona: INACTIVE, NO_PROFILE or invalid credentials. Assert Public; active profile required for successful admin login with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate login screen at 390px and 1440px, form autofill and error placement.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
C. Dashboard — primary route tests (1)
TC-DASH — /dashboard
Page: DashboardPage · Gate/permission: module dashboard
Brief note: KPIs, branch filter, date range, deep links  
- HAPPY: Authorized dashboard shows KPIs, branch/date filters and deep links. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Empty data/time window displays zero-state safely. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: No dashboard module access or failed KPI fetch handled. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner or Admin with dashboard access; denied persona: Authenticated user without dashboard module. Assert module dashboard with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate branch/date selectors, KPI cards and deep links at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
D. Sales & POS — primary route tests (13)
TC-SALE-POS — /sales/pos
Page: PosPage · Gate/permission: pos.create
Brief note: Scan barcode (registry+normalize), cart, hold, checkout, branch  
- HAPPY: Scan registry barcode; select branch; hold cart; checkout exact variant once. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Empty cart, no products, no stock. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Ambiguous barcode, concurrency stock conflict, payment retry, denied pos.create. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert pos.create with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-HELD — /sales/held
Page: HeldSalesPage · Gate/permission: pos.create
Brief note: Resume/delete held sales  
- HAPPY: Hold cart and resume/delete held sale. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No held sales. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Another employee held cart/expired session cannot be accessed. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert pos.create with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-ONLINE — /sales/online-orders
Page: OnlineOrdersPage · Gate/permission: orders.read
Brief note: List/filter statuses  
- HAPPY: Browse online orders and status filters. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No online orders. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Order fetch error or denied orders.read. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert orders.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-ONLINE-APPR — /sales/online-orders/:id/approve
Page: ApproveOnlineOrderPage · Gate/permission: orders.approve or orders.fulfil
Brief note: Approve/fulfil stock impact  
- HAPPY: Authorized user approves/fulfils valid order exactly once. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No eligible fulfillment lines. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid order, repeat approval, stock conflict, missing both permissions. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert orders.approve or orders.fulfil with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-EXCH — /sales/exchanges
Page: ExchangesPage · Gate/permission: exchange.read or exchange.create
Brief note: List exchanges  
- HAPPY: List exchange records and open exchange. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No exchanges. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Denied access; error loading exchange data. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert exchange.read or exchange.create with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-EXCH-NEW — /sales/exchanges/new
Page: ExchangeCreatePage · Gate/permission: exchange.create
Brief note: Create exchange  
- HAPPY: Create valid exchange linked to original sale. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No eligible sale items. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid quantity/foreign sale, denied exchange.create. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert exchange.create with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-HIST — /sales
Page: SalesHistoryPage · Gate/permission: sales.read
Brief note: Filters, pagination, open detail  
- HAPPY: Filter/search paginated sales and open details. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No sales match filters. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Bad page/filter and denied sales.read. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-RETS — /sales/returns
Page: SalesReturnsPage · Gate/permission: sales.read
Brief note: Return list  
- HAPPY: View sales returns and open source sale. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No returns. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Broken return reference, denied sales.read. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-COLL — /sales/collections
Page: DueCollectionPage · Gate/permission: sales.read
Brief note: Due collection  
- HAPPY: View customer dues and record permitted collection. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No dues. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Excess collection or missing linked sale fails safely. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-DET — /sales/:id
Page: SaleDetailPage · Gate/permission: sales.read
Brief note: Detail, print links  
- HAPPY: Valid saleId shows line items, amounts and print links. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional line metadata absent. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Nonexistent/foreign sale ID rejected. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-EDIT — /sales/:id/edit
Page: SaleEditPage · Gate/permission: sales.update or sales.correct
Brief note: Edit/correct  
- HAPPY: Authorized correction preserves audit and inventory effects. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Sale not editable due to status. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Insufficient permission, duplicate correction and invalid totals. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert sales.update or sales.correct with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-RET — /sales/:id/return
Page: SaleReturnPage · Gate/permission: sales.return or sales.return.review
Brief note: Process return → inventory  
- HAPPY: Process authorized return against original sale and restore correct variant state. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No returnable qty. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Over-return, repeated return, unauthorized review/access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert sales.return or sales.return.review with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SALE-COLL-ID — /sales/:id/collections
Page: DueCollectionPage · Gate/permission: sales.read
Brief note: Sale-scoped collection  
- HAPPY: Sale-scoped collection loads correct outstanding amount. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Sale fully paid. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid sale ID and overpayment blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales Manager/Cashier with specific route permission; denied persona: Staff lacking exact sales/POS permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Validate scanning/interactive forms at 390px/1440px; no overflow or lost cart state.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
E. Moderator — primary route tests (2)
TC-MOD-DASH — /moderator
Page: ModeratorDashboardPage · Gate/permission: moderator.dashboard.read
Brief note: Moderator KPIs  
- HAPPY: Moderator KPIs and own workload load. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No assigned work. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Missing moderator.dashboard.read and fetch error. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Moderator with required permission; denied persona: Staff without moderator permissions. Assert moderator.dashboard.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify work queue/actions and permission errors at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-MOD-ORD-NEW — /moderator/orders/new
Page: ModeratorOrderWorkspacePage · Gate/permission: moderator.order.create
Brief note: Create moderated order  
- HAPPY: Create valid moderated order with permitted stock checks. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No matching products/customer. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Denied moderator.order.create and invalid order data. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Moderator with required permission; denied persona: Staff without moderator permissions. Assert moderator.order.create with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify work queue/actions and permission errors at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
F. Staff workspace — primary route tests (8)
TC-STAFF-DASH — /staff/dashboard
Page: StaffDashboardPage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: Own KPI/dashboard data only. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No activity/targets. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cross-staff query blocked, parent workspace gate. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STAFF-SALES — /staff/my-sales
Page: StaffMySalesPage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: Own sales list resolves and totals are correct. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No personal sales. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Access to another staff member’s sales denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STAFF-ORD — /staff/my-orders
Page: StaffMyOrdersPage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: Own orders list and statuses. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No assigned orders. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Foreign order access denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STAFF-COMM — /staff/my-commission
Page: StaffMyCommissionPage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: Own commission amounts and source links. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No commission. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized commission disclosures blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STAFF-TGT — /staff/my-targets
Page: StaffMyTargetsPage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: Own targets and progress. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No target configured. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cannot edit another staff member’s targets. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STAFF-CUST — /staff/my-customers
Page: StaffMyCustomersPage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: Only assigned customers listed. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No customers assigned. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Foreign customer assignment not exposed. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STAFF-FU — /staff/follow-ups
Page: StaffFollowUpsPage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: Own follow-ups displayed and updated within rights. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No follow-ups. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Foreign task/lead lookup blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STAFF-PROF — /staff/profile
Page: StaffProfilePage · Gate/permission: Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope  
- HAPPY: View/update own permitted profile. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional fields blank. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Forbidden role or branch assignment change blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Staff salesperson with own-data permission; denied persona: Non-staff or staff without parent workspace gate. Assert Staff parent gate: any of staff.dashboard.read / moderator.dashboard.read / staff.sales.read_own / sales.read; enforce own-data scope with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify own-data cards/lists, sticky controls and mobile navigation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
G. Product Management 360 — primary route tests (8)
TC-PRD-LIST — /products
Page: AdminProductsPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: Search/filter by category, brand, status, stock_status; paginate, print barcode and bulk actions. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No products/zero-stock variants. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid filters, forbidden price/archive/delete actions. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRD-CAT — /products/categories
Page: CategoriesPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: List/create/edit permitted categories. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No categories yet. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate category, unauthorized write. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRD-SUB — /products/subcategories
Page: SubcategoriesPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: List/manage subcategories under valid parent category. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No subcategories. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid parent, duplicate names, unauthorized action. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRD-BRAND — /products/brands
Page: BrandsPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: List/create/update brands. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No brands. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate brand, unauthorized write. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRD-VAR — /products/variants
Page: VariantsPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: List/search variants with correct SKU/barcode/product references. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No variants. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Ambiguous barcode or missing product reference. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRD-IMP — /products/import
Page: ProductImportPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: Import valid CSV with variant columns and grouped create. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Empty upload / zero valid rows. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate SKU/barcode, partial failure and safe retry. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRD-NEW — /products/new
Page: ProductNewPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: Quick/Variant wizard, valid SKU/barcode; create zero and positive opening stock. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Save draft without opening quantity. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid form, duplicate code, duplicate submission and stock idempotency. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRD-EDIT — /products/:id/edit
Page: ProductEditPage · Gate/permission: products.read parent gate; verify mutation permissions per action  
- HAPPY: Edit existing product without changing historical variant identity. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional fields blank. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown product; changing transacted SKU/variant must not corrupt history. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with products.read; denied persona: Cashier without products.read. Assert products.read parent gate; verify mutation permissions per action with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify forms, responsive tables, barcode inputs and wizard actions at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
H. Inventory Overview 360 — primary route tests (6)
TC-INV-STOCK — /inventory/stock
Page: StockOverviewPage · Gate/permission: inventory.read
Brief note: Primary overview — see query params below  
- HAPPY: All four documented tabs render, URL filters drive RPCs and correct KPIs. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No stock/zero-stock eligible items still represented. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Bad query/branch, cost permission, >2000 low-stock, failed valuation RPC. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with inventory.read; denied persona: Cashier without inventory.read. Assert inventory.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify filters, tab state, tables/cards, drawers and KPIs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-INV-LEDGER — /inventory/ledger
Page: StockLedgerPage · Gate/permission: inventory.read
Brief note: Movement ledger filters  
- HAPPY: Search/filter stock movements and follow source documents. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No movements. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cross-branch access and malformed range rejected. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with inventory.read; denied persona: Cashier without inventory.read. Assert inventory.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify filters, tab state, tables/cards, drawers and KPIs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-INV-LOW — /inventory/low-stock
Page: LowStockPage · Gate/permission: inventory.read
Brief note: Server-side low stock (branch-scoped page)  
- HAPPY: Server-side low stock lists all matching branches and paginates. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No low-stock rows. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: >2000 balances, bad branch scope, failed RPC. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with inventory.read; denied persona: Cashier without inventory.read. Assert inventory.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify filters, tab state, tables/cards, drawers and KPIs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-INV-ADJ — /inventory/adjustments
Page: StockAdjustmentPage · Gate/permission: inventory.adjust
Brief note: Adjust → balances/ledger  
- HAPPY: Authorized stock adjustment posts once to balance and ledger. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No variants/locations to adjust. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Negative/unauthorized qty, repeated post and mismatched ledger. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with inventory.read; denied persona: Cashier without inventory.read. Assert inventory.adjust with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify filters, tab state, tables/cards, drawers and KPIs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-INV-XFER — /inventory/transfers
Page: StockTransferPage · Gate/permission: inventory.transfer
Brief note: List/dispatch/receive  
- HAPPY: List transfers; dispatch/receive and state transitions. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No transfers. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate receive/dispatch, unauthorized branch. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with inventory.read; denied persona: Cashier without inventory.read. Assert inventory.transfer with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify filters, tab state, tables/cards, drawers and KPIs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-INV-XFER-NEW — /inventory/transfers/new
Page: TransferFormPage · Gate/permission: inventory.transfer
Brief note: Create transfer  
- HAPPY: Create transfer with exact source/destination/variant. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No transferable stock. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Same branch, insufficient stock, invalid location, duplicate submission. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Inventory Manager with inventory.read; denied persona: Cashier without inventory.read. Assert inventory.transfer with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify filters, tab state, tables/cards, drawers and KPIs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
I. Purchases — primary route tests (5)
TC-PUR-LIST — /purchases
Page: PurchaseHistoryPage · Gate/permission: purchases.read
Brief note: List  
- HAPPY: View/filter purchases, open invoice detail. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No purchases. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid supplier/date filters, denied purchases.read. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with relevant purchases permission; denied persona: Cashier without purchases permission. Assert purchases.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify item grids, supplier picker and totals at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUR-RET — /purchases/returns
Page: PurchaseReturnsPage · Gate/permission: purchases.read
Brief note: Returns → stock  
- HAPPY: Return valid receipt line and update correct inventory source. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No returnable purchase lines. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Over-return or duplicate return blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with relevant purchases permission; denied persona: Cashier without purchases permission. Assert purchases.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify item grids, supplier picker and totals at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUR-PAY — /purchases/payments
Page: SupplierPaymentsPage · Gate/permission: purchases.read
Brief note: Payments  
- HAPPY: List and submit permitted supplier payments. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No outstanding payables. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Excess/duplicate payment or unauthorized access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with relevant purchases permission; denied persona: Cashier without purchases permission. Assert purchases.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify item grids, supplier picker and totals at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUR-DET — /purchases/:id
Page: PurchaseDetailPage · Gate/permission: purchases.read
Brief note: Detail  
- HAPPY: Valid purchase shows supplier, items, receipt/financial details. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional receipt lines absent. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown/foreign purchase ID denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with relevant purchases permission; denied persona: Cashier without purchases permission. Assert purchases.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify item grids, supplier picker and totals at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PUR-NEW — /purchases/new
Page: PurchaseNewPage · Gate/permission: purchases.create
Brief note: Receive stock → inventory WAC  
- HAPPY: Create valid purchase and receive exact variant into branch with WAC update. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Draft purchase with no receipt lines. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate receipt/retry, unknown variant and insufficient permission. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with relevant purchases permission; denied persona: Cashier without purchases permission. Assert purchases.create with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify item grids, supplier picker and totals at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
J. Suppliers — primary route tests (6)
TC-SUP-LIST — /suppliers
Page: SuppliersPage · Gate/permission: suppliers.read parent gate; verify action-level checks  
- HAPPY: View supplier list and open valid supplier. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No suppliers. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized supplier access or failed listing query. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with suppliers.read; denied persona: Cashier without suppliers.read. Assert suppliers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify searchable supplier lists, detail panels and forms at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SUP-IMP — /suppliers/import
Page: SupplierImportPage · Gate/permission: suppliers.read parent gate; verify action-level checks  
- HAPPY: Import supplier data with duplicate checking. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No file/valid rows. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate numbers/names and partial failure handling. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with suppliers.read; denied persona: Cashier without suppliers.read. Assert suppliers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify searchable supplier lists, detail panels and forms at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SUP-NEW — /suppliers/new
Page: SuppliersPage · Gate/permission: suppliers.read parent gate; verify action-level checks  
- HAPPY: Create supplier from existing list/create UI. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Required fields missing. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate identifier, forbidden supplier create. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with suppliers.read; denied persona: Cashier without suppliers.read. Assert suppliers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify searchable supplier lists, detail panels and forms at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SUP-DET — /suppliers/:id
Page: SupplierDetailPage · Gate/permission: suppliers.read parent gate; verify action-level checks  
- HAPPY: View supplier profile and linked purchases. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Supplier with no purchase history. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown/foreign supplier ID rejected. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with suppliers.read; denied persona: Cashier without suppliers.read. Assert suppliers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify searchable supplier lists, detail panels and forms at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SUP-EDIT — /suppliers/:id/edit
Page: SupplierDetailPage · Gate/permission: suppliers.read parent gate; verify action-level checks  
- HAPPY: Edit supplier fields without breaking historical purchases. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Supplier optional fields empty. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate or invalid contact fields, unauthorized modification. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with suppliers.read; denied persona: Cashier without suppliers.read. Assert suppliers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify searchable supplier lists, detail panels and forms at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SUP-LED — /suppliers/:id/ledger
Page: SupplierDetailPage · Gate/permission: suppliers.read parent gate; verify action-level checks  
- HAPPY: Supplier ledger shows source transactions and correct balance. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Supplier with no transactions. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Nonexistent supplier; financial field permissions enforced. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Purchase Manager with suppliers.read; denied persona: Cashier without suppliers.read. Assert suppliers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify searchable supplier lists, detail panels and forms at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
K. Customers — primary route tests (6)
TC-CUS-LIST — /customers
Page: CustomersAdminPage · Gate/permission: customers.read parent gate; verify action-level checks  
- HAPPY: List and search customers. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No customers. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized listing/access error. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales/Admin with customers.read; denied persona: Staff without customers.read. Assert customers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify customer lists, forms, actions and details at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CUS-IMP — /customers/import
Page: CustomerImportPage · Gate/permission: customers.read parent gate; verify action-level checks  
- HAPPY: Import valid customers without duplicates. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No file/valid rows. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Bad input, duplicate phones and partial failures. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales/Admin with customers.read; denied persona: Staff without customers.read. Assert customers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify customer lists, forms, actions and details at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CUS-NEW — /customers/new
Page: CustomersAdminPage · Gate/permission: customers.read parent gate; verify action-level checks  
- HAPPY: Create customer from existing list/create interface. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No customer data. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Validation, duplicate contact, insufficient rights. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales/Admin with customers.read; denied persona: Staff without customers.read. Assert customers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify customer lists, forms, actions and details at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CUS-DET — /customers/:id
Page: CustomerDetailPage · Gate/permission: customers.read parent gate; verify action-level checks  
- HAPPY: View customer history and profile. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No orders/transactions. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Foreign/customer ID not found. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales/Admin with customers.read; denied persona: Staff without customers.read. Assert customers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify customer lists, forms, actions and details at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CUS-EDIT — /customers/:id/edit
Page: CustomerDetailPage · Gate/permission: customers.read parent gate; verify action-level checks  
- HAPPY: Edit permitted customer details. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional fields blank. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid/duplicate contact and unauthorized edit. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales/Admin with customers.read; denied persona: Staff without customers.read. Assert customers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify customer lists, forms, actions and details at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CUS-LED — /customers/:id/ledger
Page: CustomerDetailPage · Gate/permission: customers.read parent gate; verify action-level checks  
- HAPPY: Customer ledger matches receivables. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No customer transactions. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid customer and hidden financial fields. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Sales/Admin with customers.read; denied persona: Staff without customers.read. Assert customers.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify customer lists, forms, actions and details at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
L. Couriers — primary route tests (6)
TC-CR-LIST — /couriers
Page: CourierCompaniesPage · Gate/permission: courier.read
Brief note: Companies  
- HAPPY: List couriers and open company detail. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No couriers configured. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Failed fetch or permission denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Courier operator with relevant courier permission; denied persona: Staff lacking courier permission. Assert courier.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify courier forms, tracking and settlements at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CR-TRACK — /couriers/tracking
Page: DeliveryTrackingPage · Gate/permission: courier.read
Brief note: Tracking  
- HAPPY: Track known parcel and status. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No parcels. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid tracking ID, unauthorized access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Courier operator with relevant courier permission; denied persona: Staff lacking courier permission. Assert courier.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify courier forms, tracking and settlements at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CR-SETL — /couriers/settlements
Page: CourierSettlementsPage · Gate/permission: courier.read
Brief note: Settlements  
- HAPPY: View settlement amounts and details. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No pending settlements. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid settlement/permissions. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Courier operator with relevant courier permission; denied persona: Staff lacking courier permission. Assert courier.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify courier forms, tracking and settlements at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CR-DET — /couriers/:id
Page: CourierCompaniesPage · Gate/permission: courier.read
Brief note: Company detail via same page  
- HAPPY: Open selected courier detail in shared page. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Company with no parcels. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid courier ID and unauthorized access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Courier operator with relevant courier permission; denied persona: Staff lacking courier permission. Assert courier.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify courier forms, tracking and settlements at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CR-PARCEL — /couriers/parcels
Page: ParcelBookingPage · Gate/permission: courier.manage or courier.book
Brief note: Book parcel  
- HAPPY: Create parcel with valid courier/order. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No eligible orders. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Missing courier.book/manage and invalid address. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Courier operator with relevant courier permission; denied persona: Staff lacking courier permission. Assert courier.manage or courier.book with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify courier forms, tracking and settlements at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-CR-RET — /couriers/returns
Page: ReturnRequestsPage · Gate/permission: sales.return.review
Brief note: Courier returns  
- HAPPY: Review courier return with original sale linkage. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No courier returns. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Denied sales.return.review and invalid return. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Courier operator with relevant courier permission; denied persona: Staff lacking courier permission. Assert sales.return.review with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify courier forms, tracking and settlements at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
M. Accounts — primary route tests (13)
TC-ACC-DASH — /accounts
Page: AccountsDashboardPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Account hub displays cash/receivables/payables KPIs. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Empty accounting period. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Denied accounts.read or failed totals. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-CASH — /accounts/cash-bank
Page: CashBankPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Display and reconcile cash/bank accounts. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No accounts/transactions. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cross-branch accounting leak and invalid transaction. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-INC — /accounts/income
Page: IncomePage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: List income records, permitted creation. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No income. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid amount, unauthorized update. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-EXP — /accounts/expenses
Page: ExpensesPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: List expenses, permitted creation. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No expenses. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid/duplicate expense, unauthorized access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-CDUE — /accounts/customer-due
Page: CustomerDuePage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Customer outstanding balances match collections. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No customer dues. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized disclosure and double collection. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-SDUE — /accounts/supplier-due
Page: SupplierDuePage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Supplier outstanding balances match purchases/payments. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No supplier dues. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized disclosure and duplicate payment. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-COLL — /accounts/collections
Page: DueCollectionPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Collect valid due and reflect account ledger. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No collectibles. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Overcollection or repeated posting. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-SPAY — /accounts/supplier-payments
Page: SupplierPaymentsPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Post permitted supplier payment and reconcile dues. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No suppliers with dues. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Overpayment and idempotency. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-CLOSE — /accounts/daily-closing
Page: DailyClosingPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Perform valid daily closing workflow. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No daily activity. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate close, conflicting date/branch. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-TXN — /accounts/transactions
Page: TransactionsPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Search/inspect transactions and source documents. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No period transactions. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid filters and inaccessible transactions. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-PL — /accounts/profit-loss
Page: ProfitLossPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Profit/loss totals reconcile to sales, purchases, expenses. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No recognized activity. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Missing cost, invalid period and permission denial. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-RECON — /accounts/reconciliation
Page: ReconciliationCenterPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Find discrepancies and compare source to account balances. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No discrepancies. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cannot hide unresolved differences or edit protected journal. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ACC-SET — /accounts/settings
Page: AccountSettingsPage · Gate/permission: accounts.read parent gate; verify action-level checks  
- HAPPY: Read/update permitted accounting settings. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No optional settings. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid configuration or insufficient privileges. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Accountant with accounts.read; denied persona: Cashier without accounts.read. Assert accounts.read parent gate; verify action-level checks with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify financial tables, currency formatting and charts at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
N. HR & commissions — primary route tests (16)
TC-HR-EMP — /hr/employees
Page: HrEmployeesPage · Gate/permission: hr.read or create/update
Brief note: List  
- HAPPY: List employees and access allowed employee data. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No employees. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: HR-only vs non-HR access, forbidden changes. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert hr.read **or** create/update with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-EMP-NEW — /hr/employees/new
Page: HrEmployeeCreatePage · Gate/permission: same
Brief note: Create  
- HAPPY: Create employee with valid details. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Required fields absent. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate employee ID and unauthorized create. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert same with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-EMP-DET — /hr/employees/:id
Page: HrEmployeeDetailPage · Gate/permission: same
Brief note: Detail  
- HAPPY: Open employee profile and linked records. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No optional employment records. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized employee data leak. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert same with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-ATT — /hr/attendance
Page: HrAttendancePage · Gate/permission: attendance read/manage/self
Brief note: Attendance  
- HAPPY: Manage/view scoped attendance as authorized. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No attendance. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Self-only cannot view others; unauthorized update. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert attendance read/manage/self with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-LEAVE — /hr/leaves
Page: HrLeavesPage · Gate/permission: leave read/approve
Brief note: Leaves  
- HAPPY: View/request/approve leave based on role. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No leave requests. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cannot self-approve without authority, invalid dates. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert leave read/approve with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-PAY — /hr/payroll
Page: HrPayrollPage · Gate/permission: payroll.* family
Brief note: Runs list  
- HAPPY: List authorized payroll runs. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No payroll runs. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Payroll restricted access, invalid period. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* family with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-PAY-NEW — /hr/payroll/new
Page: HrPayrollNewPage · Gate/permission: payroll.*
Brief note: New run  
- HAPPY: Create payroll run with valid period. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No eligible employees. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate period or missing payroll permission. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-PAY-DET — /hr/payroll/:id
Page: HrPayrollRunDetailPage · Gate/permission: payroll.*
Brief note: Detail  
- HAPPY: Open payroll run details and totals. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Empty run. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown run and unauthorized salary disclosure. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-PAY-REV — /hr/payroll/:id/review
Page: HrPayrollRunDetailPage · Gate/permission: payroll.*
Brief note: Review  
- HAPPY: Review and approve eligible payroll run. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No pending review. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Double approval/unauthorized reviewer. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-PAY-PAY — /hr/payroll/:id/payments
Page: HrPayrollRunDetailPage · Gate/permission: payroll.*
Brief note: Payments  
- HAPPY: Record payroll payments exactly once. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No unpaid items. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate payouts and permissions. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-SAL — /hr/payroll/salary-structures
Page: HrSalaryStructuresPage · Gate/permission: payroll.*
Brief note: Structures  
- HAPPY: Manage salary structures within permission. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No configured structures. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid structure or unauthorized edit. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-ADV — /hr/payroll/advances
Page: HrPayrollAdvancesPage · Gate/permission: payroll.*
Brief note: Advances  
- HAPPY: View/manage employee advances and repayments. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No advances. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Over-limit or unauthorized advance. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-PREP — /hr/payroll/reports
Page: HrPayrollReportsPage · Gate/permission: payroll.*
Brief note: Reports  
- HAPPY: Payroll reports reconcile with payroll runs. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No payroll data for period. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized export / invalid date. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-SLIP — /hr/payslips/:payrollItemId
Page: HrPayslipPage · Gate/permission: payroll.*
Brief note: Payslip  
- HAPPY: Open only authorized payslip by payroll item ID. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No issued payslip. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Foreign payslip ID blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert payroll.* with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-COMM — /hr/commissions
Page: SalesCommissionsPage · Gate/permission: sales.commission.read
Brief note: Commissions  
- HAPPY: Commission history matches sales and policy. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No commissions. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Insufficient commission read permission. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert sales.commission.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-HR-COMM-SET — /hr/commission-settings
Page: CommissionSettingsPage · Gate/permission: sales.commission.manage
Brief note: Settings  
- HAPPY: Update commission settings as authorized. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No custom rules. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Missing sales.commission.manage, invalid rule. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: HR/payroll manager with requisite HR permission; denied persona: Sales staff without HR permission. Assert sales.commission.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify HR forms, sensitive data display and data grids at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
O. Reports — primary route tests (13)
TC-REP-HUB — /reports
Page: ReportsHubPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Report hub links open permitted reports. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No report data. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Denied reports.read. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-SALES — /reports/sales
Page: SalesReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Sales totals reconcile with sales records. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No sales in range. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid date / branch access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-PUR — /reports/purchases
Page: PurchasesReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Purchase totals reconcile with receipt documents. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No purchases in range. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid filter / protected costs. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-INV — /reports/inventory
Page: InventoryReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Inventory balances and valuation reconcile with SSOT. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No eligible stock. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Out-of-stock absence, cost mask, branch scope. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-CDUE — /reports/customer-due
Page: CustomerDueReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Customer due report equals ledger/collections. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No customer dues. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized financial access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-TOP — /reports/top-customers
Page: TopCustomersReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Rank customer totals from correct sales scope. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No customers for period. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Wrong ranking due to canceled/refunded sales. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-SDUE — /reports/supplier-due
Page: SupplierDueReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Supplier due equals purchases/payments. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No supplier dues. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cost/payment access and totals errors. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-PROF — /reports/profit
Page: ProfitReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Profit totals reconcile with historical COGS. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No realized sales. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Estimated WAC fallback incorrectly labelled realized. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-BR — /reports/branch
Page: BranchReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Branch report isolates authorized branches. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: One branch has no activity. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cross-branch data leak. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-SP — /reports/salesperson
Page: SalespersonReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Salesperson totals reconcile with source sales. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No staff sales. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Sales credited to wrong staff. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-PP — /reports/product-performance
Page: ProductPerformanceReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Product/variant performance follows canonical IDs. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No sales for selected product. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Archived variant loses historical sales link. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-CR — /reports/courier
Page: CourierReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Courier report reconciles parcel statuses. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No courier items. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Status inconsistency or incorrect permission. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-REP-CRR — /reports/courier-returns
Page: CourierReturnsReportPage · Gate/permission: reports.read parent gate; verify export/print access  
- HAPPY: Courier returns report matches return records. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No returns. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Return double-counted. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Manager with reports.read; denied persona: Cashier without reports.read. Assert reports.read parent gate; verify export/print access with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify report filters, charts, legends and print/export at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
P. Administration — primary route tests (8)
TC-ADM-HUB — /administration
Page: AdministrationHubPage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: parent gate
Brief note: Hub  
- HAPPY: Administrative links reflect permitted modules. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No configured administrative actions. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Parent gate denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: parent gate with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ADM-USERS — /administration/users
Page: AdminUsersListPage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: users.read OR settings.manage
Brief note: Users  
- HAPPY: List users and filter by status/branch. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No users matching filters. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized user list/access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: users.read OR settings.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ADM-USER-NEW — /administration/users/new
Page: AdminUserInvitePage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: users.create OR settings.manage
Brief note: Invite  
- HAPPY: Invite valid user with scoped roles. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No pending invites. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Duplicate email/role escalation blocked. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: users.create OR settings.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ADM-USER-DET — /administration/users/:id
Page: AdminUserDetailPage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: users.read OR settings.manage
Brief note: Detail/branches  
- HAPPY: View user profile and authorized branches. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: User with no branch assignment. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Foreign user or unauthorized role escalation. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: users.read OR settings.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ADM-ROLES — /administration/roles
Page: AdminRolesPage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: roles.manage OR settings.manage
Brief note: Roles  
- HAPPY: View/update roles with authorized permissions. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No custom roles. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Role escalation attempt denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: roles.manage OR settings.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ADM-PERM — /administration/permissions
Page: AdminPermissionsPage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: permissions.read OR settings.manage
Brief note: Permissions matrix  
- HAPPY: Display correct permission matrix. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No custom permission set. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized permission change. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: permissions.read OR settings.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ADM-ACT — /administration/activity
Page: ActivityLogsPage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: activity.read OR audit.read
Brief note: Activity  
- HAPPY: View audit events with actor/time. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No events match filters. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unauthorized audit disclosure or missing events. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: activity.read OR audit.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-ADM-TGT — /administration/targets
Page: AdminTargetsPage · Gate/permission: Parent any-of administration.read / administration.users.read / settings.manage; nested: staff.targets.manage OR settings.manage
Brief note: Targets  
- HAPPY: Manage staff targets as authorized. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No targets. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cross-staff or branch target edit denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Owner/Admin with required admin and nested permissions; denied persona: Staff without administration permissions. Assert Parent any-of administration.read / administration.users.read / settings.manage; nested: staff.targets.manage OR settings.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify security settings/forms, permission table and dialogs at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
Q. Settings & stores — primary route tests (11)
TC-SET — /settings
Page: SettingsPage · Gate/permission: settings.manage
Brief note: Org settings  
- HAPPY: View/edit organization settings as authorized. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No optional settings. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Forbidden settings change, invalid values. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert settings.manage with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-WEB — /settings/website
Page: WebsiteSettingsPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: Website hub  
- HAPPY: Website settings hub loads and links tabs. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No configured website data. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Missing website access, failed fetch. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-WEB-HOME — /settings/website/homepage
Page: WebsiteHomepageTabPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: Homepage  
- HAPPY: Edit and preview permitted homepage content. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No configured blocks. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid changes and unauthorized publish. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-WEB-SEO — /settings/website/seo
Page: WebsiteSeoTabPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: SEO  
- HAPPY: Edit valid SEO fields. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No SEO metadata. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid metadata or unauthorized edit. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-WEB-SOC — /settings/website/social
Page: WebsiteSocialTabPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: Social  
- HAPPY: Edit social URLs and preview. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No connected social pages. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Malformed URL / insufficient rights. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-WEB-CON — /settings/website/contact
Page: WebsiteContactTabPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: Contact  
- HAPPY: Edit public contact information. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No optional address fields. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid phone/email and unauthorized edit. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-HERO-NEW — /settings/website/hero/new
Page: HeroSlideEditorPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: New hero  
- HAPPY: Create slide and preview. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No slide asset. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid file and unauthorized create. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-HERO-EDIT — /settings/website/hero/:id
Page: HeroSlideEditorPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: Edit hero  
- HAPPY: Edit existing hero without affecting other slides. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No optional image. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown slide ID or forbidden update. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-HERO-PREV — /settings/website/hero/:id/preview
Page: HeroSlidePreviewPage · Gate/permission: website.* relevant permission OR settings.manage (verify exact code)
Brief note: Preview  
- HAPPY: Preview actual hero slide without editing. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No content / blank preview. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid slide ID and access denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert website.* relevant permission OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-SET-RESET — /settings/data-reset
Page: DataResetSettingsPage · Gate/permission: settings.data_reset
Brief note: Destructive reset — extra confirm  
- HAPPY: Privileged user sees destructive reset flow with extra confirmation. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Nothing eligible for reset. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Non-privileged user cannot reach or execute reset. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert settings.data_reset with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-STORES — /stores
Page: StoresPage · Gate/permission: stores.read OR stores.manage OR settings.manage (verify exact code)
Brief note: Branches/stores  
- HAPPY: List branch/stores and permitted details. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No branch items. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Cross-branch management denied. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Website editor/Owner with required permission; denied persona: Staff without settings/website permission. Assert stores.read OR stores.manage OR settings.manage (verify exact code) with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify settings editor/preview controls and layout at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
R. Print — primary route tests (7)
TC-PRT-SALE-A4 — /print/sales/:id/a4
Page: PrintSaleA4Page · Gate/permission: sales.read
Brief note: A4 invoice  
- HAPPY: Render correct A4 invoice for authorized sale. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional address/tax missing. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Bad ID, no sales.read, missing document. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Authorized document reader with listed print permission; denied persona: Role without print source read permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify print CSS (A4/receipt as appropriate) and print preview on desktop; route load at 390px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRT-SALE-POS — /print/sales/:id/pos
Page: PrintSalePosPage · Gate/permission: sales.read
Brief note: POS receipt  
- HAPPY: Render POS-sized receipt with correct amounts. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional buyer details missing. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Bad ID / unauthorized sale. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Authorized document reader with listed print permission; denied persona: Role without print source read permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify print CSS (A4/receipt as appropriate) and print preview on desktop; route load at 390px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRT-SALE-GIFT — /print/sales/:id/gift-label
Page: PrintSaleGiftLabelPage · Gate/permission: sales.read
Brief note: Gift label  
- HAPPY: Render correct gift label for authorized sale. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No gift note. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid sale or denied access. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Authorized document reader with listed print permission; denied persona: Role without print source read permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify print CSS (A4/receipt as appropriate) and print preview on desktop; route load at 390px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRT-SALE-REP — /print/sales/report
Page: PrintSalesReportPage · Gate/permission: sales.read
Brief note: Sales report print  
- HAPPY: Render sales report print with filters. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No report rows. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Denied sales.read and no cost leak. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Authorized document reader with listed print permission; denied persona: Role without print source read permission. Assert sales.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify print CSS (A4/receipt as appropriate) and print preview on desktop; route load at 390px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRT-PUR-A4 — /print/purchases/:id/a4
Page: PrintPurchaseA4Page · Gate/permission: purchases.read
Brief note: Purchase A4  
- HAPPY: Render authorized purchase invoice. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Optional invoice fields absent. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown ID or denied purchases.read. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Authorized document reader with listed print permission; denied persona: Role without print source read permission. Assert purchases.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify print CSS (A4/receipt as appropriate) and print preview on desktop; route load at 390px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRT-EXCH — /print/exchanges/:id
Page: PrintExchangeReceiptPage · Gate/permission: exchange.read
Brief note: Exchange receipt  
- HAPPY: Render valid exchange receipt. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No optional details. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Invalid exchange / denied exchange.read. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Authorized document reader with listed print permission; denied persona: Role without print source read permission. Assert exchange.read with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify print CSS (A4/receipt as appropriate) and print preview on desktop; route load at 390px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
TC-PRT-REP — /print/reports/:reportType
Page: PrintReportPage · Gate/permission: reports.read or reports.print
Brief note: Generic report print  
- HAPPY: Render supported report type with correct permission. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: Report has no rows. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Unknown reportType and missing both reporting permissions. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Authorized document reader with listed print permission; denied persona: Role without print source read permission. Assert reports.read or reports.print with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify print CSS (A4/receipt as appropriate) and print preview on desktop; route load at 390px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
S. Catch-all — primary route tests (1)
TC-NF — *
Page: NotFoundPage · Gate/permission: Public catch-all  
- HAPPY: Unknown path shows NotFoundPage with safe navigation. Expected: correct records, navigation and transaction state; persist/refresh when action is state-changing.
- EMPTY: No matching route by definition. Expected: accessible meaningful empty/zero state, no crash or stale totals.
- ERROR / DENIED: Encoded malformed URL should not crash app. Expected: actionable or non-disclosing error, correct rollback, no unauthorized mutation.
- RBAC: Allowed persona: Any user; denied persona: N/A: public 404. Assert Public catch-all with both permitted and blocked fixtures; never infer production grants from role labels.
- RESPONSIVE: Verify back/home CTAs and responsive 404 presentation at 390px/1440px.
- Evidence/Result: Status NOT RUN; attach screenshot/request/record ID and assert backend state for mutations.
2. Redirect-only route assertions (no unique page UI)
ID	Alias	Expected canonical destination/verification	Guard notes
SALE-NEW	/sales/new	/sales/pos; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
SALE-COMM	/sales/commissions	/hr/commissions; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
SALE-COMM-SET	/sales/commission-settings	/hr/commission-settings; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
ORD-*	/orders, /orders/new, /orders/*	Sales/POS canonical destination; verify mapping per specific alias in router; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
STAFF	/staff	/staff/dashboard; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
PRD-DET	/products/:id	ProductDetailRedirectPage — inspect actual final destination, do not assume; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
INV	/inventory	/inventory/stock; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
INV-BRANCH	/inventory/branch-stock	/inventory/stock; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
HR	/hr	/hr/employees; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
SET-ACT	/activity-logs	/administration/activity; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
PRT-ORD	/print/orders/*	/sales; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias
HR	16	/hr/employees; assert final URL and browser history; no separate page-state test	Assert documented guard if applicable; no bypass through alias

For the source’s other redirects (Accounts aliases and Reports aliases), assert only the listed canonical destinations in the supplied brief, with the same authorization protections. Do not generate separate page UI tests for aliases.
Accounts redirect assertions
- /accounts/chart → /accounts/settings (assert URL only).
- /accounts/journals → /accounts/transactions (assert URL only).
- /accounts/general-ledger → /accounts/transactions (assert URL only).
- /accounts/cash-flow → /accounts/transactions (assert URL only).
- /accounts/trial-balance → /accounts/profit-loss (assert URL only).
- /accounts/balance-sheet → /accounts/profit-loss (assert URL only).
- /accounts/setup → /accounts/settings (assert URL only).
- /accounts/customer-ledger → /accounts/customer-due (assert URL only).
- /accounts/customer-dues → /accounts/customer-due (assert URL only).
- /accounts/supplier-ledger → /accounts/supplier-due (assert URL only).
- /accounts/supplier-dues → /accounts/supplier-due (assert URL only).
- /accounts/cashbook → /accounts/cash-bank (assert URL only).
- /accounts/banks → /accounts/cash-bank (assert URL only).
- /accounts/mobile-banking → /accounts/cash-bank (assert URL only).
Reports redirect assertions
- /reports/products → /reports/product-performance (assert URL only).
- /reports/branches → /reports/branch (assert URL only).
- /reports/accounts → /accounts/profit-loss (assert URL only).
- /reports/hr → /hr/payroll (assert URL only).
3. Dedicated RBAC/security gate matrix
Gate	Positive test	Negative/abuse test
AdminAuthGuard	Active session + active profile opens protected route	GUEST redirects with state.from; INACTIVE reason=inactive; NO_PROFILE blocking state
PermissionRoute	Single required permission grants route	NO_PERM redirects to /dashboard; API also blocks direct calls
Any-of permission arrays	Each single qualifying permission independently grants route	User with none of listed permissions blocked; never require all
Dashboard module	hasAnyModuleAccess for dashboard permits access	User without dashboard module denied
POS / pos.create	CASHIER with pos.create performs authorized sale	No pos.create cannot access POS or submit checkout
Sales read/update/correct	Assigned permission opens list/edit/correction	Read alone cannot edit; no sales.correct cannot correct
Return/review	Either documented return permission can pass route gate	Neither return nor review permission can reach return route; action-specific checks
Online order approve/fulfil	orders.approve-only and orders.fulfil-only separately tested	Neither cannot enter; action endpoint still enforces exact operation
Moderator parent + nested	Each allowed parent permission tested separately, then nested actions	Missing exact moderator.order.create blocks create
Staff parent + own scope	Own records only with each allowed parent grant	Cross-employee ID and unassigned customer/order blocked
Products parent	products.read allows catalog; mutation grants tested separately	Non-product role denied and cannot mutate via API
Inventory read	inventory.read loads authorized branches	Denied role and branch-B data blocked
Inventory cost masking	Any intentionally granted valuation/accounting/price permission exposes cost	CASHIER with only inventory.read sees masked cost in UI, RPC and export
Inventory adjust/transfer	inventory.adjust or inventory.transfer enables respective route	inventory.read alone cannot post adjustment or transfer
Purchases	purchases.read vs purchases.create separated	Read-only cannot create or receive
Suppliers/customers	suppliers.read / customers.read parent permits own module	Denies other module and invalid tenant/branch records
Courier read/book/manage	courier.read; courier.book or courier.manage where documented	One grant not substituted for another outside documented OR
Accounts	accounts.read permits hub and read pages; mutations restricted	CASHIER lacks financial read; direct query leaks blocked
HR & payroll	hr.read/create/update, attendance, leave, payroll.* separately	Staff role cannot view others’ salary, payslips, advances
Reports	reports.read opens report views	Unauthorized export and unmasked finance data rejected
Admin parent + nested	Each documented parent OR plus nested permission verified	Parent access without nested privilege cannot edit users/roles
Settings & website	settings.manage or applicable website.* grants editors	WEB_EDITOR cannot reset data or manage unrelated admin modules
Data reset	settings.data_reset + additional typed/step confirmation	Denied role never reaches reset; replay of confirmation rejected
Print	Authorized print permission + admin session prints	Guessable document IDs and print routes cannot bypass source permission
Storefront account	CUSTOMER can access only own account data	GUEST/foreign CUSTOMER denied
Public secure invoice	Valid token renders public document	Expired/guessed token no access or user enumeration
Branch isolation	BRANCH_MGR sees branch A data	Branch B URL/API/CSV not accessible

4. INV-STOCK complete URL/filter contract
Source-documented contract: view=branches|products|variants|low-stock (default branches), branch, q, status, category, brand, damaged, quarantine, sort, sortDir, page, location.
ID	Scenario	Assertion
STK-Q01	Default /inventory/stock	Loads Branch Summary and current permitted branch totals
STK-Q02	view=branches/products/variants/low-stock	Each tab maps to URL and correct table, back/forward works
STK-Q03	view=unknown	Safely normalizes or rejects invalid view; never crashes
STK-Q04	branch=all and valid branch UUID	Scope changes totals and detail rows; no unauthorized branch leakage
STK-Q05	branch=foreign UUID	No foreign stock disclosed by UI, direct RPC or CSV
STK-Q06	q=product name/sku/barcode registry identifier	Results include intended product/variant and matched filtered KPI scope
STK-Q07	status=in_stock / low_stock / out_of_stock	Common server semantics; zero-eligible items represented
STK-Q08	status=negative_stock/in_transit/damaged/quarantine	View-aware filters are correctly supported or disabled, never silently ignored
STK-Q09	category/brand valid IDs, category+brand combined	Filtered results, total count and KPI reconcile
STK-Q10	damaged=1 and quarantine=1	Explicit inclusion behavior, no accidental saleable double count
STK-Q11	sort=stock_value	quantity
STK-Q12	sortDir=asc/desc and page=1,2, invalid page	Server pagination returns stable values and safe invalid handling
STK-Q13	location UUID	Location filter respected by actual RPC, not only URL display
STK-Q14	Branch Summary View Stock action	Changes to view=products and retains selected branch
STK-Q15	Current Page export	Matches currently visible filtered page, only authorized columns
STK-Q16	All Filtered export	Includes all authorized filtered rows, not just page 20
STK-Q17	Cost masking	Without inventory.valuation/accounting.view/products.manage_prices no cost/profit in RPC, UI, exports
STK-Q18	Low Stock >2000 balances	Server-side query paginates all results, not client 2000 cap
STK-Q19	Zero-stock seeded product	Appears under out-of-stock for eligible scope
STK-Q20	Unique product/variant KPI	Does not confuse branch listing sum with distinct catalog IDs
STK-Q21	Stock mutation invalidation	Receive/sale/transfer/adjust/return refresh all affected tabs and KPIs

Supplier Stock extension — PLANNED, not confirmed by uploaded route audit
The file does not list view=suppliers, supplier-source RPCs or a supplier-provenance schema. Treat this as a release-readiness extension after implementation, not as an existing verified route.
ID	Proposed test	Expected behavior
SUPST-01	view=suppliers via fifth tab	Tab opens without a new primary route and preserves URL state
SUPST-02	Supplier/branch/category/variant filters	Server-side filtering before pagination; KPI and export scope match
SUPST-03	Two suppliers same variant; 50 + 30 received; 20 sold FIFO	A remaining 30, B remaining 30, total 60; labeled system-allocated
SUPST-04	Verified lot source	Exact supplier, receipt, branch and lot provenance preserved
SUPST-05	Legacy unattributed balance	Shows Unknown Legacy Source instead of guessed supplier
SUPST-06	Branch transfer	Supplier identity follows allocated quantity, transfer is not new receipt
SUPST-07	Return/exchange/void	Original allocation restored or conditionally quarantined, no double counting
SUPST-08	Partial receiving and retries	Receipt source and physical stock posted exactly once
SUPST-09	Receipt cohort vs as-of date	Different date semantics correctly labeled and computed
SUPST-10	Supplier cost masking	Users without valuation permission cannot read sensitive RPC values or exports
SUPST-11	Reconciliation	Sum supplier-attributed + unknown physical qty equals SSOT on-hand by variant/branch/location/condition
SUPST-12	Performance and RLS	Server paginates, blocks cross-tenant/branch supplier stock

5. Cross-module E2E acceptance pack
Execute against disposable fixtures; verify persisted database state, not only toast messages. Record before/after inventory_balances, stock_ledger, source document and corresponding reports.
E2E-01: Login → dashboard
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: GUEST redirected; active OWNER enters; inactive blocked; missing profile blocking state.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-02: Products Quick Add zero-stock
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Create simple product; default variant; search by SKU; Out of Stock appears in INV-STOCK.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-03: Products variant+opening stock
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Create multi-variant product; unique barcodes; source-backed opening stock increases exact variant/branch.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-04: Purchase receiving → WAC
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: PUR-NEW receives 5 units at selected cost into branch A; INV-STOCK and ledger update once; WAC reconciles.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-05: Barcode POS sale
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: SALE-POS scans exact variant, checks available, completes sale once; INV-STOCK branch variant decrements and sale detail shows correct line.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-06: Sale return/exchange
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: SALE-RET or SALE-EXCH returns/corrects exact source sale, stock movement and financial entries consistent.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-07: Stock adjustment
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: INV-ADJ writes authorized audited ledger movement once and refreshed KPIs.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-08: Stock transfer
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: INV-XFER-NEW dispatch/receive moves quantity between A/B with in-transit handling; no duplication.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-09: Online order fulfillment
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: PUB-PDP → cart → checkout → admin approval/fulfil; correct variant and reservation/stock effects once.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-10: Supplier purchase → stock → due
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: PUR-NEW receipt links SUP-DET/SUP-LED and ACC-SDUE/ACC-SPAY; inventory + accounting reconcile.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-11: Customer due → collection
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: SALE-DET/COLL and ACC-COLL/CDUE/REP-CDUE reflect payment exactly once.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-12: Commission integration
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: SALE-POS/online order contributions match STAFF-COMM, HR-COMM, REP-SP; return reversal handled.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-13: Product management → public catalog
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: PRD-NEW activation and publication gates control PUB-SHOP/PDP; draft hidden.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-14: Barcode collision/alias
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Duplicate barcode reject; ambiguous legacy code does not resolve silently; POS returns controlled error.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-15: Multi-branch security
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: BRANCH_MGR of A cannot query B through UI, direct URL, RPC, print/export.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-16: Inventory report reconciliation
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: INV-STOCK, INV-LEDGER, INV-LOW and REP-INV match the same product/variant/branch scope.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-17: Public invoice token
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Valid secureToken public invoice works without admin session; invalid/expired token blocked.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-18: Website hero editing
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: WEB_EDITOR changes authorized hero; public homepage reflects only published content.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-19: HR payroll & payslip
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Authorized HR payroll run and payslip; unrelated staff cannot view protected salary.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-20: Courier booking/returns
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Parcel booking/tracking and courier return reconcile with order/return data.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-21: Global export+print
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Reports/stock export and print output match filtered scope, mask restricted cost and honor permissions.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-22: Concurrent checkout
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Two purchases of limited variant cannot oversell or double deduct; repeated request idempotent.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-23: Supplier provenance (after feature release)
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Two suppliers same variant: receiving, sale, transfer, return and Unknown Legacy reconcile to stock SSOT.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
E2E-24: Admin roles & reset safety
- Setup: Use seeded fixtures and relevant allowed/denied personas.
- Action: Execute workflow end to end using listed registered routes only.
- Expected: Parent/nested grants prevent escalation; data-reset inaccessible without settings.data_reset plus confirmation.
- Evidence: UI trace, relevant request/status, before/after canonical DB facts, role, branch and data reconciliation.
- Status: NOT RUN.
6. Proposed Playwright implementation structure (planning only)
tests/e2e/
  auth/                      # AUTH-LOGIN, AdminAuthGuard
  public/                    # PUB-*
  products/                  # PRD-*
  sales/                     # SALE-*, MOD-*, STAFF-*
  inventory/                 # INV-STOCK URL matrix, ledger, adjustments, transfers
  purchases-suppliers/       # PUR-*, SUP-*
  finance/                   # ACC-*, REP-*
  admin-security/            # ADM-*, SET-*
  hr/                        # HR-*
  print/                     # PRT-*
  critical-flows/            # E2E-01..E2E-24
  fixtures/                  # safe seed helpers and persona fixtures
Automation requirements: isolate test data per case; use authorized test logins only; never bypass RLS; do not store secrets in test snapshots; verify database outcomes with authorized test endpoints/service-role in secure CI only; use deterministic waits rather than sleeps; no broad screenshot assertions without controlled fixtures.
Example pseudocode — not a claimed runnable test
test("INV-STOCK preserves Branch Summary drilldown", async ({ page }) => {
  await loginAsAuthorizedInventoryManager(page);
  await page.goto("/inventory/stock?view=branches");
  await chooseBranchFromFixture(page, "BRANCH_A");
  await page.getByRole("button", { name: /view stock/i }).first().click();
  await expect(page).toHaveURL(/view=products/);
  await expect(page).toHaveURL(/branch=/);
  // Verify actual scope via server response and displayed table.
});
Selectors/fixture helpers above are illustrative; discover the actual UI locators in the repository.
7. Release gate and evidence requirements
Gate	Required to mark PASS	Severity if failed
Route coverage	Every primary route has happy, empty, error, RBAC and 390px/1440px result	P1
Authentication	Missing/inactive/no-profile and state.from behavior verified	P0
Authorization	PermissionRoute OR semantics, parent+nested gates, branch RLS and cost masks verified	P0
Inventory data integrity	No double post/negative stock; stock ledger and balances reconcile	P0
Financial integrity	WAC, returns and supplier payments reconcile	P0
Public privacy	Public token and customer account scope verified	P0
Critical workflows	E2E-01..24 applicable flows pass; record N/A for unimplemented supplier feature	P0/P1
Redirects	All alias URLs reach exact documented destinations without bypass	P1
UI responsiveness	No horizontal overflow, broken form, missing action at designated viewports	P1/P2
Print/export	Permission-masked data and correct scope, print rendering	P1
Build/test pipeline	TypeScript/build/registered route tests plus relevant integration E2E executed	P1
Migration	Supplier extension only released after staging migration, backfill, reconciliation and approval	P0

Execution record template
Case ID | Environment | Date/time | Persona | Branch | Inputs | Expected | Actual | PASS/FAIL/BLOCKED/N/A | Severity | Screenshot/video | Server/log evidence | Defect ticket | Owner | Retest status

Important: No actual route, permission, screen, stock, supplier provenance or migration execution is asserted in this document. Claims are constrained to the user-provided route audit; additional supplier testing is labeled planned.
