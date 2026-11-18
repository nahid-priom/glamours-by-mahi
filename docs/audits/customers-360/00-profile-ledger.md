# Customer Profile & Enhanced Ledger

**Date:** 2026-11-18

## Routes (finalized)

| Path | Behavior |
|------|----------|
| `/customers` | Directory (admin table) |
| `/customers/new` | Same directory |
| `/customers/import` | CSV import |
| `/customers/:id?tab=ledger\|orders\|details` | Profile shell (default ledger) |
| `/customers/:id/ledger` | Redirect → `?tab=ledger` |
| `/customers/:id/edit` | Redirect → `?tab=details&edit=1` |

## Tabs

1. **Customer ledger** — `get_customer_ledger_statement` (migration `00156`): opening / sales / collections / closing, date presets, type filter, search, pagination, CSV, expandable rows, sale deep-links
2. **Sales history** — recent invoices via `listCustomerSales`
3. **Customer details** — profile fields + edit dialog

## Quick actions

- Collect due → `/accounts/dues?tab=customers&customerId=`
- New sale → `/sales/pos?customerId=`
- Edit / archive (customers.manage)

## Migration

`supabase/migrations/20260315000156_customer_ledger_statement.sql`
