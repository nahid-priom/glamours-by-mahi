# Payment Account Branch Scope

| Flow | Branch authority |
|---|---|
| Sale collection | Sale `branch_id` (not unrelated UI branch) |
| POS | Active POS sale branch |
| Supplier pay / purchase pay-now | Active / purchase branch |
| Income / expense / closing | `activeBranchId` |
| Courier / payroll / commission | Org-wide FA list when policy allows; user must pick explicitly |
| Exchange | Org-wide list (authorized shared FAs) |

Do not broaden RLS solely to populate a dropdown.
