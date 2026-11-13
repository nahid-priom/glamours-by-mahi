# 09 — Route QA Matrix (summary)

| Route | Functional | Visual | Auth E2E |
|-------|------------|--------|----------|
| `/dashboard` | Working (V2 UI) | Screenshot | Pass |
| `/sales/pos` | Working | Screenshot | Pass |
| `/administration/activity` | Needs mig 124 on linked DB | Screenshot | Pass (page loads; RPC may error until migration) |
| `/staff/*` | Working for staff; hidden for Super Admin nav | — | Nav assert pass |
| Sales/Inventory/Purchases/Accounts | Working (pre-existing) | Unverified screenshot | Unverified |
| Reports/Courier/HR | Working/Partial | Unverified | Unverified |

Full path inventory: `02-route-coverage.md`.
