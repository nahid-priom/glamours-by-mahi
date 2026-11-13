# 02 — Route Coverage

Generated from route modules. Status reflects pre-finalization audit.

| Path | Module | Guard / notes | Status |
|------|--------|---------------|--------|
| `/accounts` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/cash-bank` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/income` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/expenses` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/customer-due` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/supplier-due` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/collections` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/supplier-payments` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/daily-closing` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/transactions` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/profit-loss` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/reconciliation` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/settings` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/chart` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/journals` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/general-ledger` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/trial-balance` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/balance-sheet` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/cash-flow` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/setup` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/customer-ledger` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/supplier-ledger` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/cashbook` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/banks` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/mobile-banking` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/customer-dues` | accounts | see `accounts.routes.tsx` | Working |
| `/accounts/supplier-dues` | accounts | see `accounts.routes.tsx` | Working |
| `/administration` | administration | see `administration.routes.tsx` | Working |
| `/administration/users/new` | administration | see `administration.routes.tsx` | Working |
| `/administration/users` | administration | see `administration.routes.tsx` | Working |
| `/administration/users/:id` | administration | see `administration.routes.tsx` | Working |
| `/administration/roles` | administration | see `administration.routes.tsx` | Working |
| `/administration/permissions` | administration | see `administration.routes.tsx` | Working |
| `/administration/activity` | administration | see `administration.routes.tsx` | Broken→fixing |
| `/administration/targets` | administration | see `administration.routes.tsx` | Working |
| `/couriers` | courier | see `courier.routes.tsx` | Working |
| `/couriers/tracking` | courier | see `courier.routes.tsx` | Working |
| `/couriers/settlements` | courier | see `courier.routes.tsx` | Working |
| `/couriers/:id` | courier | see `courier.routes.tsx` | Working |
| `/couriers/parcels` | courier | see `courier.routes.tsx` | Working |
| `/couriers/returns` | courier | see `courier.routes.tsx` | Working |
| `/customers` | customers | see `customers.routes.tsx` | Working |
| `/customers/import` | customers | see `customers.routes.tsx` | Working |
| `/customers/new` | customers | see `customers.routes.tsx` | Working |
| `/customers/:id` | customers | see `customers.routes.tsx` | Working |
| `/customers/:id/edit` | customers | see `customers.routes.tsx` | Working |
| `/customers/:id/ledger` | customers | see `customers.routes.tsx` | Working |
| `/dashboard` | dashboard | see `dashboard.routes.tsx` | Working |
| `/hr` | hr | see `hr.routes.tsx` | Working |
| `/hr/employees` | hr | see `hr.routes.tsx` | Working |
| `/hr/employees/new` | hr | see `hr.routes.tsx` | Working |
| `/hr/employees/:id` | hr | see `hr.routes.tsx` | Working |
| `/hr/attendance` | hr | see `hr.routes.tsx` | Working |
| `/hr/leaves` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll/salary-structures` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll/advances` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll/reports` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll/new` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll/:id/review` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll/:id/payments` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll/:id` | hr | see `hr.routes.tsx` | Working |
| `/hr/payslips/:payrollItemId` | hr | see `hr.routes.tsx` | Working |
| `/hr/payroll` | hr | see `hr.routes.tsx` | Working |
| `/hr/commissions` | hr | see `hr.routes.tsx` | Working |
| `/hr/commission-settings` | hr | see `hr.routes.tsx` | Working |
| `/inventory` | inventory | see `inventory.routes.tsx` | Working |
| `/inventory/stock` | inventory | see `inventory.routes.tsx` | Working |
| `/inventory/branch-stock` | inventory | see `inventory.routes.tsx` | Working |
| `/inventory/ledger` | inventory | see `inventory.routes.tsx` | Working |
| `/inventory/low-stock` | inventory | see `inventory.routes.tsx` | Working |
| `/inventory/adjustments` | inventory | see `inventory.routes.tsx` | Working |
| `/inventory/transfers` | inventory | see `inventory.routes.tsx` | Working |
| `/inventory/transfers/new` | inventory | see `inventory.routes.tsx` | Working |
| `/moderator` | moderator | see `moderator.routes.tsx` | Working |
| `/moderator/orders/new` | moderator | see `moderator.routes.tsx` | Working |
| `/print` | print | see `print.routes.tsx` | Working |
| `orders/*` | print | see `print.routes.tsx` | Working |
| `sales/report` | print | see `print.routes.tsx` | Working |
| `sales/:id/a4` | print | see `print.routes.tsx` | Working |
| `sales/:id/pos` | print | see `print.routes.tsx` | Working |
| `sales/:id/gift-label` | print | see `print.routes.tsx` | Working |
| `purchases/:id/a4` | print | see `print.routes.tsx` | Working |
| `exchanges/:id` | print | see `print.routes.tsx` | Working |
| `reports/:reportType` | print | see `print.routes.tsx` | Working |
| `/public/invoice/:secureToken` | print | see `print.routes.tsx` | Working |
| `/products` | products | see `products.routes.tsx` | Working |
| `/products/categories` | products | see `products.routes.tsx` | Working |
| `/products/subcategories` | products | see `products.routes.tsx` | Working |
| `/products/brands` | products | see `products.routes.tsx` | Working |
| `/products/variants` | products | see `products.routes.tsx` | Working |
| `/products/import` | products | see `products.routes.tsx` | Working |
| `/products/new` | products | see `products.routes.tsx` | Working |
| `/products/:id/edit` | products | see `products.routes.tsx` | Working |
| `/products/:id` | products | see `products.routes.tsx` | Working |
| `/purchases` | purchases | see `purchases.routes.tsx` | Working |
| `/purchases/returns` | purchases | see `purchases.routes.tsx` | Working |
| `/purchases/payments` | purchases | see `purchases.routes.tsx` | Working |
| `/purchases/:id` | purchases | see `purchases.routes.tsx` | Working |
| `/purchases/new` | purchases | see `purchases.routes.tsx` | Working |
| `/reports` | reports | see `reports.routes.tsx` | Working |
| `/reports/sales` | reports | see `reports.routes.tsx` | Working |
| `/reports/purchases` | reports | see `reports.routes.tsx` | Working |
| `/reports/inventory` | reports | see `reports.routes.tsx` | Working |
| `/reports/customer-due` | reports | see `reports.routes.tsx` | Working |
| `/reports/top-customers` | reports | see `reports.routes.tsx` | Working |
| `/reports/supplier-due` | reports | see `reports.routes.tsx` | Working |
| `/reports/profit` | reports | see `reports.routes.tsx` | Working |
| `/reports/branch` | reports | see `reports.routes.tsx` | Working |
| `/reports/salesperson` | reports | see `reports.routes.tsx` | Working |
| `/reports/product-performance` | reports | see `reports.routes.tsx` | Working |
| `/reports/courier` | reports | see `reports.routes.tsx` | Working |
| `/reports/courier-returns` | reports | see `reports.routes.tsx` | Working |
| `/reports/products` | reports | see `reports.routes.tsx` | Working |
| `/reports/branches` | reports | see `reports.routes.tsx` | Working |
| `/reports/accounts` | reports | see `reports.routes.tsx` | Working |
| `/reports/hr` | reports | see `reports.routes.tsx` | Working |
| `/sales/pos` | sales | see `sales.routes.tsx` | Working |
| `/sales/new` | sales | see `sales.routes.tsx` | Working |
| `/sales/held` | sales | see `sales.routes.tsx` | Working |
| `/sales/online-orders` | sales | see `sales.routes.tsx` | Working |
| `/sales/online-orders/:id/approve` | sales | see `sales.routes.tsx` | Working |
| `/sales/exchanges` | sales | see `sales.routes.tsx` | Working |
| `/sales/exchanges/new` | sales | see `sales.routes.tsx` | Working |
| `/sales` | sales | see `sales.routes.tsx` | Working |
| `/sales/returns` | sales | see `sales.routes.tsx` | Working |
| `/sales/commissions` | sales | see `sales.routes.tsx` | Working |
| `/sales/commission-settings` | sales | see `sales.routes.tsx` | Working |
| `/sales/collections` | sales | see `sales.routes.tsx` | Working |
| `/sales/:id` | sales | see `sales.routes.tsx` | Working |
| `/sales/:id/edit` | sales | see `sales.routes.tsx` | Working |
| `/sales/:id/return` | sales | see `sales.routes.tsx` | Working |
| `/sales/:id/collections` | sales | see `sales.routes.tsx` | Working |
| `/orders` | sales | see `sales.routes.tsx` | Working |
| `/orders/new` | sales | see `sales.routes.tsx` | Working |
| `/orders/*` | sales | see `sales.routes.tsx` | Working |
| `/settings` | settings | see `settings.routes.tsx` | Working |
| `/activity-logs` | settings | see `settings.routes.tsx` | Broken→fixing |
| `/settings/website` | settings | see `settings.routes.tsx` | Working |
| `/settings/website/homepage` | settings | see `settings.routes.tsx` | Working |
| `/settings/website/seo` | settings | see `settings.routes.tsx` | Working |
| `/settings/website/social` | settings | see `settings.routes.tsx` | Working |
| `/settings/website/contact` | settings | see `settings.routes.tsx` | Working |
| `/settings/website/hero/new` | settings | see `settings.routes.tsx` | Working |
| `/settings/website/hero/:id/preview` | settings | see `settings.routes.tsx` | Working |
| `/settings/website/hero/:id` | settings | see `settings.routes.tsx` | Working |
| `/settings/data-reset` | settings | see `settings.routes.tsx` | Working |
| `/stores` | settings | see `settings.routes.tsx` | Working |
| `/staff` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/dashboard` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/my-sales` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/my-orders` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/my-commission` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/my-targets` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/my-customers` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/follow-ups` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/staff/profile` | staff | see `staff.routes.tsx` | Working (nav policy fix) |
| `/` | storefront | see `storefront.routes.tsx` | Working |
| `shop` | storefront | see `storefront.routes.tsx` | Working |
| `category/:slug` | storefront | see `storefront.routes.tsx` | Working |
| `product/:slug` | storefront | see `storefront.routes.tsx` | Working |
| `cart` | storefront | see `storefront.routes.tsx` | Working |
| `checkout` | storefront | see `storefront.routes.tsx` | Working |
| `order-success/:orderId` | storefront | see `storefront.routes.tsx` | Working |
| `track-order` | storefront | see `storefront.routes.tsx` | Working |
| `account` | storefront | see `storefront.routes.tsx` | Working |
| `orders` | storefront | see `storefront.routes.tsx` | Working |
| `profile` | storefront | see `storefront.routes.tsx` | Working |
| `wishlist` | storefront | see `storefront.routes.tsx` | Working |
| `addresses` | storefront | see `storefront.routes.tsx` | Working |
| `search` | storefront | see `storefront.routes.tsx` | Working |
| `offline` | storefront | see `storefront.routes.tsx` | Working |
| `/suppliers` | suppliers | see `suppliers.routes.tsx` | Working |
| `/suppliers/import` | suppliers | see `suppliers.routes.tsx` | Working |
| `/suppliers/new` | suppliers | see `suppliers.routes.tsx` | Working |
| `/suppliers/:id` | suppliers | see `suppliers.routes.tsx` | Working |
| `/suppliers/:id/edit` | suppliers | see `suppliers.routes.tsx` | Working |
| `/suppliers/:id/ledger` | suppliers | see `suppliers.routes.tsx` | Working |

See also public storefront and print routes in `index.tsx`, `storefront.routes.tsx`, `print.routes.tsx`.


## Priority
1. `/dashboard`, `/sales/pos`, `/administration/activity`, `/staff/*` nav
2. Sales/inventory/purchases/accounts
3. Reports/courier polish
