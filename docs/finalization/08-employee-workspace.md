# 07 / Employee Workspace

## Nav policy
Super Admin / Owner: **My Workspace** sidebar group hidden (`AppSidebar`).
Staff with `staff.*` permissions: personal portal under `/staff/*`.

## Privacy
Migration `00126` tightens `employees` RLS to self-or-HR select.
Staff commission RPCs remain self-scoped (migration 108).

## Earnings
Never treat total sales as income. Commission statuses via staff commission RPCs.
