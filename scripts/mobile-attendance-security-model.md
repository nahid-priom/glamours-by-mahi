# Mobile Attendance — Security Model (Final Hardening)

## Trust boundaries

1. **Mobile client is untrusted** for biometric/signature/integrity booleans.
2. **Biometric proof** = successful hardware-backed `createSignature` (non-exportable key). Edge sets `biometric_gate_used` only after signature verify.
3. **Submit path:** Edge Function verifies JWT + ECDSA canonical signature + integrity, mints HMAC attestation (`mint_attendance_submit_attestation`), calls `submit_mobile_attendance` as **service_role**.
4. **RPC:** `REVOKE EXECUTE … FROM authenticated`; rejects missing/invalid attestation; re-resolves employee from `auth_user_id`.
5. **RLS:** Employees SELECT own attendance rows only; no INSERT/UPDATE/DELETE on finalized attendance tables.
6. **QR:** HMAC-signed tokens; issue requires manage/device.approve.
7. **Idempotency:** payload hash bound; conflict if key reused with different hash.
8. **Corrections:** immutable `attendance_adjustments`; never silent rewrite of finalized payroll items.

## Secrets

| Secret | Location | Consumers |
|--------|----------|-----------|
| `attendance_submit_hmac` | `app_runtime_secrets` / Vault | SECURITY DEFINER helpers |
| `attendance_qr_hmac` | same | QR issue/verify |
| Play Integrity API | Edge secrets | `evaluateIntegrity` |
| Service role | Edge runtime only | Never in Expo app |

## Integrity modes

- Non-production default: `dev_bypass`
- Production: forced `enforce`; `dev_bypass` throws
