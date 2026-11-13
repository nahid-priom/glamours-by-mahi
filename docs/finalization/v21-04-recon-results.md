# V2.1 — Reconciliation Results

**Route:** `/accounts/reconciliation`  
**Policy:** Dry-run diagnostics only for this production rollout.

## Behavior verified in code
- Report load via existing reconciliation hooks / discrepancy paths (migrations `035` / `049` lineage).
- Authorized dry-run repair logging allowed.
- **Apply / silent historical rewrite remains disabled** (`Button disabled`, subtitle documents the gate).

## Verdict
**Partial by design.** Read + dry-run Working. Apply blocked until an explicit, audited production apply RPC is authorized outside this V2.1 pass.
