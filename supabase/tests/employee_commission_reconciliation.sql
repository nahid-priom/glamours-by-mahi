-- Employee commission bridge reconciliation (run after migration 068)

SELECT 'commission_rows' AS metric, count(*)::bigint AS value
FROM public.salesman_commissions WHERE deleted_at IS NULL
UNION ALL
SELECT 'needs_employee_link', count(*)::bigint
FROM public.salesman_commissions WHERE deleted_at IS NULL AND needs_employee_link = true
UNION ALL
SELECT 'with_employee_id', count(*)::bigint
FROM public.salesman_commissions WHERE deleted_at IS NULL AND employee_id IS NOT NULL
UNION ALL
SELECT 'gross_accrued', coalesce(sum(commission_amount), 0)
FROM public.salesman_commissions WHERE deleted_at IS NULL AND status NOT IN ('reversed', 'cancelled')
UNION ALL
SELECT 'net_paid', coalesce(sum(commission_amount), 0)
FROM public.salesman_commissions WHERE deleted_at IS NULL AND status = 'paid'
UNION ALL
SELECT 'active_rules_employee', count(*)::bigint
FROM public.salesman_commission_rules WHERE deleted_at IS NULL AND is_active AND employee_id IS NOT NULL;
