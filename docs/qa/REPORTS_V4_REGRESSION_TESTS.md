# Reports V4 — Regression Tests

## Automated (Vitest)

```bash
npm run test:unit -- src/features/reports
```

Covered:

- No duplicate `profitReport` on `reportsRepository`
- Canonical net profit fixture semantics
- Stable `reportQueryKey` prefix
- Registry: returns/channels available; stock-aging gated; courier requires `courier.read`
- Date presets default to This Month
- Scenario A discount + partial return arithmetic (7,000 net sales / 3,000 GP)
- Cash deposit non-P&L classification; transfers excluded from cash-flow moneyIn

## Manual / staging checklist

| ID | Scenario | Status |
|---|---|---|
| A | Discount + partial return across Sales / Returns / Product / P&L | Manual pending |
| B | Cross-period return recognition | Manual pending |
| C | Multi-branch totals + unauthorized branch | Manual pending |
| D | Pagination does not change KPI totals | Manual pending (inventory totals span all rows) |
| E | Courier delivered ≠ settled COD | Manual pending |
| F | Inventory variant / zero / damaged | Manual pending |
| G | Cost columns hidden without valuation perms | Manual pending |
| H | Empty/invalid ranges, voided docs, org switch | Manual pending |

## Gates

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit -- src/features/reports`
- `npm run build`
