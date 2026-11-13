# 01 — System Audit

**Project:** Glamorous Gallery By Mahi ERP  
**Date:** 2026-11-13  
**Stack:** React 19 + TypeScript + Vite 8, Tailwind 4, TanStack Query, Supabase/PostgreSQL, Vitest, Playwright  
**Linked project:** `vahqinuminrcjpussimn`

## Architecture

- Entry: `index.html` → `src/main.tsx` → `src/app/App.tsx` → `RouterProvider` (`src/app/routes/index.tsx`)
- Admin chrome: `AdminAuthGuard` → `DashboardLayout` → feature routes (lazy via `lazy.tsx`)
- Auth: `src/features/auth/auth-session.tsx` (session restore, profile, role permissions, branch)
- Permissions: `src/lib/permissions/catalog.ts` + `PermissionRoute` / `PermissionGate`
- Supabase client: `src/lib/supabase/client.ts` (anon/publishable key only)
- Design tokens: `src/index.css` (`--color-primary` `#ff3f7f`, Manrope/Playfair)

## Module status (initial)

| Area | Status | Notes |
|------|--------|-------|
| POS `/sales/pos` | Working | `complete_pos_sale` RPC; mobile cart sheet |
| Dashboard `/dashboard` | Partial vs ref | Live RPC; flat KPIs; Quick Actions unmounted |
| Activity `/administration/activity` | Broken | `list_activity_feed` CTE `scoped` bug |
| My Workspace | Working (wrong nav) | Visible to Super Admin via `*` |
| Sales/Inventory/Purchases | Working | Core RPCs present |
| Accounts | Working | Simple retail + journal engines |
| HR/Payroll | Partial | Attendance↔payroll gaps remain |
| Courier | Working | COD/booking as implemented |
| Legacy ErpRoutes | Orphan | Not mounted |

## Critical defects

1. `relation "scoped" does not exist` in `list_activity_feed` (migration 098)
2. Dashboard `profitToday` = collection − expenses (not gross − COGS − expenses)
3. Super Admin sees My Workspace
4. Historical recon backlog (deferred — dry-run only)

## Financial definitions (authoritative for V2)

- **Net Sales:** completed sales `grand_total` in range (less returns handled via return postings)
- **Collections:** `paid_total` on completed sales in range (due collections tracked separately in collections module)
- **Gross Profit:** net sales − COGS (`sale_items.qty * cost_price`)
- **Net Profit:** Gross Profit − posted `expense_entries` in range
- **Customer/Supplier Due:** `current_due` caches from canonical party ledger
