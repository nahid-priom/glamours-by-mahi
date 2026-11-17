# REPORT 6 — Due Management & Overdue Rules Audit

## Current capabilities (VERIFIED)

| Capability | Customer | Supplier | Evidence |
|---|---|---|---|
| Outstanding total on party | `customers.current_due` | `suppliers.current_due` | migrations `00004`, ledger helpers `00065`+ |
| Ledger history | `customer_ledger` | `supplier_ledger` | same |
| List parties with due > 0 | CustomerDuePage / repo | SupplierDuePage / repo | `simple-accounting.repository.ts` |
| Collect / pay RPC | `collect_customer_due` | `pay_supplier` | latest redefine `00066` |
| Partial payment | Supported in RPC payloads | Supported | SQL |
| FIFO invoice allocation | `_allocate_customer_collection` | `_allocate_supplier_payment` | `00033` |
| Payment history UI | Due collection / payments pages | SupplierPaymentsPage | sales/purchases features |
| Advance | `customers.current_advance` | settings allow supplier advance | `00075`, account settings |
| Recon vs open docs | `v_recon_customer_due_vs_sales` | `v_recon_supplier_due_vs_purchases` | `00035`/`00062` |
| Reports | `/reports/customer-due` | `/reports/supplier-due` | reports feature |

## Missing for target Due Management UI (VERIFIED gaps)

| Target capability | Status |
|---|---|
| Unified Customer/Supplier tabs page | Not present (two pages) |
| Invoice-wise outstanding drawer as first-class | Partial via allocation tables; UI weak |
| Due date on invoices | **UNVERIFIED / not found** as AR term field driving aging |
| Overdue days / aging buckets (0–30, 31–60, 90+) | **Not implemented** |
| Due soon / status chips (Current / Partial / Overdue / Paid) | Not on Accounts due pages |
| Asia/Dhaka aging cutoff | Date helpers exist (`lib/datetime/bd`) but unused for AR aging |
| Write-off workflow | Not found as dedicated AR write-off UI |

“Overdue” elsewhere refers to **staff follow-ups** or **customer rating heuristics**, not formal AR aging (`StaffDashboardPage`, rating formula) — do not reuse as Due Management overdue.

## Receivable invariants (intended)

1. Credit sale increases party due and open sale `due_total`.  
2. Collection decreases due ≤ outstanding; FIFO allocates oldest open sales.  
3. Returns adjust AR without inventing duplicate collections.  
4. Party `current_due` should reconcile to open docs (+ opening docs) via recon views.

Prior production dry-run (unified-core report) found **non-zero** customer/supplier due deltas vs docs — historical opening gaps may still exist (**VERIFIED historical evidence; UNVERIFIED current**).

## Recommended unified Due Management architecture (PROPOSED)

**Do not create parallel due balance tables.**

1. **Read model façade page** `/accounts/dues` with tabs: Customers | Suppliers.  
2. Reuse `listCustomerDues` / `listSupplierDues` + existing collect/pay RPCs.  
3. Add **optional** additive columns later: `sales.due_date`, `purchases.due_date` (or terms days → computed due date).  
4. Add **SQL view/RPC** `get_party_due_aging` computing buckets from due_date or `completed_at + terms`.  
5. Invoice drawer: join open sales/purchases + `payment_allocations`.  
6. Redirect `/accounts/customer-due` & `/accounts/supplier-due` after parity.  
7. Keep `/sales/collections` and `/purchases/payments` as power-user/deep links.

### Strategy choice

| Strategy | Pros | Cons |
|---|---|---|
| Aggregate existing services only | Fast UI; no migration | Cannot show true overdue without dates |
| Additive due_date + aging RPC | Matches approved design | Needs backfill policy for old invoices |
| New due tables | — | **Rejected** — duplicates SSOT |

**Preferred:** aggregate now + additive due_date/aging in Phase 1–3.
