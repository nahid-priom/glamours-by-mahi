# Branch-First Final Release Audit & QA Report

**Date:** 2026-11-17  
**Environment audited:** Linked Supabase project `vahqinuminrcjpussimn` (CLI labels **production**). Local Docker stack unavailable (`docker: command not found`).  
**App under test:** `http://localhost:5173` (Vite).  
**Recommendation:** **CONDITIONAL GO** for Branch-First UI + pricing harden — see blockers.

---

## 1. Migration deployment status

| Migration | Status |
|-----------|--------|
| `20260315000143_storefront_fulfillment_context` | Already present on remote (migration list local=remote). Smoke via `TEST_DATABASE_URL` succeeded. |
| `20260315000144_harden_resolve_effective_price_anon` | **Applied** on the same DB (function replace + grant revoke PUBLIC). Recorded in `supabase_migrations.schema_migrations`. |

**Preflight notes**
- Local `supabase start` not possible (no Docker/Podman).
- Remote apply of 00143 was already done before this audit.
- 00144 applied as additive security harden (SECURITY DEFINER body + grants). Not a destructive migration.
- **No further production push performed beyond 00144 harden.**

**Smoke — `get_storefront_fulfillment_context`**
- Returns `branch_id`, `saleable_location_ids`, `prices`.
- Example org: Head Office `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1`, 1 saleable location, prices array populated.
- Grantees: `anon`, `authenticated`, `service_role` (PUBLIC revoked after 00144).

---

## 2. Database / RPC security findings

| Finding | Severity | Resolution |
|---------|----------|------------|
| `resolve_effective_price` was `SECURITY DEFINER` with `PUBLIC`/`anon` EXECUTE and **no** published/active/org/branch checks | High | Fixed in `00144`: org match, active product, active branch, variant ownership; **anon requires `published_at`**; unpublished → `0`. |
| `PUBLIC` EXECUTE on price/fulfillment helpers | Medium | Revoked; explicit grants to anon/authenticated/service_role |

**Verified after harden**
- Published product: resolves non-zero price (sample `3000`).
- Unpublished/inactive as `anon`: returns `0`.
- Grantees for `resolve_effective_price`: anon, authenticated, postgres, service_role (no PUBLIC).

---

## 3. Storefront fulfillment verification

- Rule: `ORDER BY is_central DESC, created_at ASC` — matches `place_online_order`.
- Live data: single central **Head Office / Central Warehouse**; fulfillment branch id equals that rule’s pick (`fulfillment_matches_online_rule: true`).
- FE: `storefront-catalog.repository.ts` scopes stock to fulfillment saleable location ids and applies branch price index.
- Fail-closed: empty location set → stock claimed as 0.

---

## 4. Branch pricing verification

- Precedence unchanged: branch+variant → branch+product → variant/product selling price.
- Unit tests: `resolve-branch-price.test.ts` — 2/2 passed.
- Anon leak path closed for unpublished products (see §2).

---

## 5. Stock reconciliation (read-only)

Saleable balances vs `stock_ledger.quantity_delta` net (same saleable locations), top 40 by activity:

- **sample_size:** 40  
- **mismatch_count:** 0  
- Examples matched (on_hand = ledger_net): GBM-DRS-MON-Ivo-M 206, GBM-BAG-PRL-OS 147, etc.

Damaged/quarantine isolation: **4** balance rows with qty **4** remain on non-saleable locations (not mixed into saleable recon).

**No automatic balance corrections were made.**

---

## 6. E2E test results

### Playwright (authenticated)

```
npx playwright test e2e/products/branch-first-release.spec.ts \
  e2e/modules/products-purchases-pos.spec.ts \
  e2e/critical-flows/e2e-01-to-24.spec.ts --project=desktop
```

- **29 passed**, **6 skipped**, **0 failed** (~22.6s)

Branch-First suite highlights (passed):
- Admin listing branch stock copy visible
- Wizard: no “Select location” / Location label
- Adjustment + transfer: auto-resolve copy, no location dropdowns
- POS + storefront shells load

Skipped (by design / env):
- Playwright `dbReady()` **denies** `TEST_DATABASE_URL` when host contains production project ref `vahqinuminrcjpussimn` → DB tests in Playwright skipped.
- Concurrent checkout / supplier provenance / ledger sample skips in critical flows.

### Not fully automated

- Full **8-variant × 26 pcs** wizard activate + cross-branch balance proof was **not** completed as a mutating UI E2E in this run (shell + no-location asserts only). Manual or future mutating factory recommended on a **non-production** DB.

### Responsive

```
npx playwright test e2e/responsive/viewports.spec.ts --project=desktop
```

- **2 passed** (shop + authenticated shells across required widths)

---

## 7. UI responsive QA

- Responsive suite passed for public shop and authenticated critical shells.
- Branch-First pages exercised in E2E without location pickers.
- No horizontal-overflow failures reported by the responsive suite.

---

## 8. Build results

| Gate | Result |
|------|--------|
| Unit (location + price helpers) | **5/5 passed** |
| `tsc --noEmit -p tsconfig.app.json` | **clean** (exit 0) |
| `npm run lint` (oxlint) | **exit 0** (pre-existing warnings only) |
| `npm run build` | **passed** (~897ms + PWA; integrity OK) |

---

## 9. Remaining release blockers / risks

1. **No isolated local Supabase** in this agent environment (Docker missing) — all DB evidence is against the linked cloud project.
2. Playwright DB helpers intentionally block that project ref — automated E2E DB asserts skipped (manual/node scripts used instead).
3. **Full wizard 8×26 opening-stock posting E2E** not executed end-to-end.
4. Concurrent checkout / provenance critical cases still skipped.
5. Ensure `00144` is in git and any other environments receive the same migration via normal `db:push` workflow.
6. Confirm org always has **exactly one** `is_central` branch operationally (currently true for sampled org).

---

## 10. GO / NO-GO

### **CONDITIONAL GO**

**GO for:** Branch-First UI behavior (listing, wizard location-free stock, adjustments/transfers auto-location), storefront fulfillment RPC, pricing harden `00144`, saleable ledger recon sample (0 gaps), unit/tsc/lint/build, authenticated shell E2E.

**NO-GO for claiming “full Phase 5–6 complete”** until:
- Mutating 8×26 wizard stock post is proven on a **denylisted-safe** staging DB (or approved manual QA checklist signed), and
- Concurrent mutation / provenance tests are unskipped and green.

**Do not** treat this as approval to run additional destructive production migrations without a separate explicit authorization.
