-- Migration 121: Reservation expiry schedule, courier webhook status RPC,
-- payroll↔commission flags, daily closing expected cash (Asia/Dhaka).

--------------------------------------------------------------------------------
-- 2A. Schedule expire_online_reservations when pg_cron is available
--------------------------------------------------------------------------------
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'expire_online_reservations_15m';

  PERFORM cron.schedule(
    'expire_online_reservations_15m',
    '*/15 * * * *',
    $job$SELECT public.expire_online_reservations(NULL);$job$
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable — schedule expire_online_reservations externally: %', SQLERRM;
END;
$cron$;

COMMENT ON FUNCTION public.expire_online_reservations(uuid) IS
  'Releases expired online order stock reservations. Prefer pg_cron every 15m or invoke via service_role.';

--------------------------------------------------------------------------------
-- 2B. Service-role webhook status applicator (canonical COD path)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_courier_webhook_parcel_status(
  p_parcel_id uuid,
  p_status text,
  p_notes text DEFAULT NULL,
  p_external_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parcel public.courier_parcels%ROWTYPE;
  v_status text;
  v_allowed text[] := ARRAY[
    'booked', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled'
  ];
  v_cod_result jsonb;
  v_actor uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  v_status := lower(btrim(coalesce(p_status, '')));
  IF NOT (v_status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Invalid parcel status: %', p_status;
  END IF;

  SELECT * INTO v_parcel
  FROM public.courier_parcels cp
  WHERE cp.id = p_parcel_id
    AND cp.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;

  v_actor := coalesce(v_parcel.updated_by, v_parcel.created_by);

  IF v_parcel.status = v_status THEN
    IF v_status = 'delivered' AND coalesce(v_parcel.cod_amount, 0) > 0 THEN
      v_cod_result := public._apply_courier_cod_accounting(p_parcel_id, v_actor);
    END IF;
    RETURN jsonb_build_object(
      'parcel_id', p_parcel_id,
      'status', v_status,
      'idempotent', true,
      'cod', v_cod_result
    );
  END IF;

  IF v_parcel.status = 'delivered'
     AND v_status IN ('returned', 'cancelled', 'failed') THEN
    PERFORM public._reverse_courier_cod_accounting(p_parcel_id, v_actor, p_notes);
  END IF;

  PERFORM set_config('app.allow_parcel_status', '1', true);

  UPDATE public.courier_parcels
  SET status = v_status,
      delivered_at = CASE
        WHEN v_status = 'delivered' THEN coalesce(delivered_at, timezone('utc', now()))
        WHEN v_status IN ('returned', 'cancelled', 'failed') THEN NULL
        ELSE delivered_at
      END,
      updated_at = timezone('utc', now())
  WHERE id = p_parcel_id;

  IF v_status = 'delivered' THEN
    v_cod_result := public._apply_courier_cod_accounting(p_parcel_id, v_actor);
  END IF;

  IF NULLIF(btrim(coalesce(p_external_event_id, '')), '') IS NOT NULL THEN
    INSERT INTO public.courier_events (
      organization_id, courier_company_id, parcel_id,
      external_event_id, event_type, payload, occurred_at, processed_at
    ) VALUES (
      v_parcel.organization_id, v_parcel.courier_company_id, p_parcel_id,
      'webhook-status-' || p_external_event_id || '-' || v_status,
      v_status,
      jsonb_build_object(
        'notes', p_notes,
        'source', 'apply_courier_webhook_parcel_status',
        'external_event_id', p_external_event_id
      ),
      timezone('utc', now()), timezone('utc', now())
    )
    ON CONFLICT (external_event_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'parcel_id', p_parcel_id,
    'status', v_status,
    'idempotent', false,
    'cod', v_cod_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_courier_webhook_parcel_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_courier_webhook_parcel_status(uuid, text, text, text) TO service_role;

--------------------------------------------------------------------------------
-- 2E. calculate_payroll_run: honor commission payroll flags + write allocations
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_payroll_run(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_run public.payroll_runs%ROWTYPE;
  v_key text;
  v_emp public.employees%ROWTYPE;
  v_scheduled_days int;
  v_present numeric(8,2) := 0;
  v_half numeric(8,2) := 0;
  v_absent numeric(8,2) := 0;
  v_paid_leave numeric(8,2) := 0;
  v_unpaid_leave numeric(8,2) := 0;
  v_holiday numeric(8,2) := 0;
  v_weekly_off numeric(8,2) := 0;
  v_late_days int := 0;
  v_ot_minutes int := 0;
  v_daily_rate numeric(14,2);
  v_earned_basic numeric(14,2);
  v_allowances numeric(14,2);
  v_att_ded numeric(14,2);
  v_leave_ded numeric(14,2);
  v_late_ded numeric(14,2);
  v_commission numeric(14,2);
  v_advance_rec numeric(14,2);
  v_loan_rec numeric(14,2);
  v_gross numeric(14,2);
  v_net numeric(14,2);
  v_item_id uuid;
  v_count int := 0;
  v_payable_days numeric(8,2);
  v_comm record;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('hr.payroll.calculate')
     AND NOT public.user_has_permission('hr.payroll.create') THEN
    RAISE EXCEPTION 'Missing permission hr.payroll.calculate' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = NULLIF(payload->>'payroll_run_id', '')::uuid
    AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status NOT IN ('draft', 'recalculation_required', 'calculated') THEN
    RAISE EXCEPTION 'Payroll run cannot be calculated in status %', v_run.status;
  END IF;

  v_key := coalesce(NULLIF(payload->>'client_txn_key', ''), 'calc:' || v_run.id::text);
  IF v_run.status = 'calculated' AND v_run.calculated_at IS NOT NULL
     AND v_run.calculation_version > 0
     AND coalesce(payload->>'force', 'false') <> 'true' THEN
    RETURN jsonb_build_object('payroll_run_id', v_run.id, 'employee_count', (
      SELECT count(*) FROM public.payroll_items WHERE payroll_run_id = v_run.id AND deleted_at IS NULL
    ), 'idempotent', true);
  END IF;

  v_scheduled_days := greatest(public._payroll_scheduled_days(v_run.period_start, v_run.period_end), 1);

  -- Soft-delete prior allocations then items for recalculation
  UPDATE public.payroll_commission_allocations pca
  SET deleted_at = timezone('utc', now()), updated_by = v_profile_id
  WHERE pca.payroll_run_id = v_run.id AND pca.deleted_at IS NULL;

  UPDATE public.payroll_items SET deleted_at = timezone('utc', now())
  WHERE payroll_run_id = v_run.id AND deleted_at IS NULL;

  FOR v_emp IN
    SELECT e.*
    FROM public.employees e
    WHERE e.organization_id = v_org_id
      AND e.deleted_at IS NULL
      AND e.status = 'active'
      AND (
        v_run.scope_type = 'organization'
        OR (v_run.scope_type = 'branch' AND e.branch_id = v_run.branch_id)
        OR (v_run.scope_type = 'department' AND e.department = v_run.department)
        OR (v_run.scope_type = 'selected' AND e.id IN (
          SELECT (jsonb_array_elements_text(v_run.employee_ids))::uuid
        ))
      )
  LOOP
    SELECT
      coalesce(sum(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'half_day' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'holiday' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'weekly_off' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.late_minutes > 0 THEN 1 ELSE 0 END), 0),
      coalesce(sum(ar.overtime_minutes), 0)
    INTO v_present, v_half, v_absent, v_paid_leave, v_holiday, v_weekly_off, v_late_days, v_ot_minutes
    FROM public.attendance_records ar
    WHERE ar.employee_id = v_emp.id
      AND ar.organization_id = v_org_id
      AND ar.work_date BETWEEN v_run.period_start AND v_run.period_end
      AND ar.deleted_at IS NULL
      AND ar.is_approved = true;

    SELECT coalesce(sum(lr.days), 0) INTO v_unpaid_leave
    FROM public.leave_requests lr
    WHERE lr.employee_id = v_emp.id
      AND lr.organization_id = v_org_id
      AND lr.status = 'approved'
      AND lr.leave_type IN ('unpaid', 'lwp')
      AND lr.start_date <= v_run.period_end
      AND lr.end_date >= v_run.period_start
      AND lr.deleted_at IS NULL;

    v_daily_rate := CASE
      WHEN v_emp.salary_type = 'daily' THEN v_emp.basic_salary
      WHEN v_emp.salary_type = 'hourly' THEN v_emp.basic_salary * 8
      ELSE round(v_emp.basic_salary / v_scheduled_days, 2)
    END;

    v_payable_days := v_present + v_half * 0.5 + v_paid_leave + v_holiday + v_weekly_off;

    v_earned_basic := CASE
      WHEN v_emp.salary_type = 'monthly' THEN round(v_emp.basic_salary * v_payable_days / v_scheduled_days, 2)
      WHEN v_emp.salary_type = 'daily' THEN round(v_daily_rate * v_payable_days, 2)
      ELSE round(v_emp.basic_salary * (v_payable_days * 8 + v_ot_minutes / 60.0), 2)
    END;

    v_allowances := round(coalesce((v_emp.allowances->>'total')::numeric, 0), 2);
    v_att_ded := round(v_absent * v_daily_rate, 2);
    v_leave_ded := round(v_unpaid_leave * v_daily_rate, 2);
    v_late_ded := round(v_late_days * v_daily_rate * 0.1, 2);

    -- Only include commissions when employee is payroll-paid for commission
    IF coalesce(v_emp.include_commission_in_payroll, true)
       AND coalesce(v_emp.commission_payment_mode, 'select_at_approval') <> 'direct' THEN
      SELECT coalesce(sum(sc.commission_amount), 0) INTO v_commission
      FROM public.salesman_commissions sc
      WHERE sc.employee_id = v_emp.id
        AND sc.organization_id = v_org_id
        AND sc.status = 'approved'
        AND sc.deleted_at IS NULL
        AND sc.created_at::date BETWEEN v_run.period_start AND v_run.period_end
        AND NOT EXISTS (
          SELECT 1 FROM public.payroll_commission_allocations pca
          WHERE pca.commission_id = sc.id AND pca.deleted_at IS NULL
        );
    ELSE
      v_commission := 0;
    END IF;

    SELECT coalesce(sum(remaining_amount), 0) INTO v_advance_rec
    FROM public.employee_advances
    WHERE employee_id = v_emp.id AND organization_id = v_org_id
      AND status IN ('disbursed', 'recovering') AND deleted_at IS NULL
    LIMIT 1;

    v_advance_rec := least(coalesce(v_advance_rec, 0), v_emp.basic_salary * 0.5);

    SELECT coalesce(installment_amount, 0) INTO v_loan_rec
    FROM public.employee_loans
    WHERE employee_id = v_emp.id AND organization_id = v_org_id
      AND status = 'active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

    v_gross := round(v_earned_basic + v_allowances, 2);
    v_net := greatest(round(
      v_gross + round(v_ot_minutes / 60.0 * v_daily_rate * 0.5, 2) + v_commission
      - v_att_ded - v_leave_ded - v_late_ded - v_advance_rec - coalesce(v_loan_rec, 0),
    2), 0);

    INSERT INTO public.payroll_items (
      organization_id, payroll_run_id, employee_id,
      basic_salary, allowances, overtime, bonus,
      attendance_deduction, leave_deduction, other_deductions,
      net_salary, gross_salary, commission_amount,
      outstanding_amount, payment_status,
      employee_snapshot, attendance_snapshot, breakdown, calculation_version
    ) VALUES (
      v_org_id, v_run.id, v_emp.id,
      v_earned_basic, v_allowances, round(v_ot_minutes / 60.0 * v_daily_rate * 0.5, 2), 0,
      v_att_ded, v_leave_ded, v_late_ded + v_advance_rec + coalesce(v_loan_rec, 0),
      v_net, v_gross, v_commission,
      v_net, 'unpaid',
      jsonb_build_object(
        'employee_code', v_emp.employee_code,
        'full_name', v_emp.full_name,
        'designation', v_emp.designation,
        'department', v_emp.department,
        'branch_id', v_emp.branch_id,
        'commission_payment_mode', v_emp.commission_payment_mode,
        'include_commission_in_payroll', v_emp.include_commission_in_payroll
      ),
      jsonb_build_object(
        'scheduled_days', v_scheduled_days,
        'present', v_present, 'half_day', v_half, 'absent', v_absent,
        'paid_leave', v_paid_leave, 'unpaid_leave', v_unpaid_leave,
        'holiday', v_holiday, 'weekly_off', v_weekly_off,
        'late_days', v_late_days, 'overtime_minutes', v_ot_minutes,
        'payable_days', v_payable_days, 'daily_rate', v_daily_rate
      ),
      jsonb_build_object(
        'advance_recovery', v_advance_rec,
        'loan_installment', v_loan_rec,
        'client_txn_key', v_key
      ),
      v_run.calculation_version + 1
    )
    RETURNING id INTO v_item_id;

    IF v_commission > 0 THEN
      FOR v_comm IN
        SELECT sc.id, sc.commission_amount
        FROM public.salesman_commissions sc
        WHERE sc.employee_id = v_emp.id
          AND sc.organization_id = v_org_id
          AND sc.status = 'approved'
          AND sc.deleted_at IS NULL
          AND sc.created_at::date BETWEEN v_run.period_start AND v_run.period_end
          AND NOT EXISTS (
            SELECT 1 FROM public.payroll_commission_allocations pca
            WHERE pca.commission_id = sc.id AND pca.deleted_at IS NULL
          )
      LOOP
        INSERT INTO public.payroll_commission_allocations (
          organization_id, payroll_run_id, payroll_item_id, commission_id,
          included_amount, created_by, updated_by
        ) VALUES (
          v_org_id, v_run.id, v_item_id, v_comm.id,
          v_comm.commission_amount, v_profile_id, v_profile_id
        );
      END LOOP;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.payroll_runs pr
  SET
    status = 'calculated',
    calculated_at = timezone('utc', now()),
    calculated_by = v_profile_id,
    calculation_version = pr.calculation_version + 1,
    recalculation_required = false,
    total_gross = sub.gross,
    total_deductions = sub.ded,
    total_net = sub.net,
    outstanding = sub.net,
    updated_by = v_profile_id
  FROM (
    SELECT
      coalesce(sum(basic_salary + allowances + overtime + bonus + commission_amount), 0) AS gross,
      coalesce(sum(attendance_deduction + leave_deduction + other_deductions), 0) AS ded,
      coalesce(sum(net_salary), 0) AS net
    FROM public.payroll_items
    WHERE payroll_run_id = v_run.id AND deleted_at IS NULL
  ) sub
  WHERE pr.id = v_run.id;

  INSERT INTO public.payroll_approval_logs (
    organization_id, payroll_run_id, action, from_status, to_status, created_by
  ) VALUES (v_org_id, v_run.id, 'calculated', v_run.status, 'calculated', v_profile_id);

  RETURN jsonb_build_object('payroll_run_id', v_run.id, 'employee_count', v_count);
END;
$$;

--------------------------------------------------------------------------------
-- Block direct commission pay when already allocated to payroll
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_sales_commission(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_commission_id uuid;
  v_client_txn_key text;
  v_fin_acct uuid;
  v_row public.salesman_commissions%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_mode text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.commission.pay') THEN
    RAISE EXCEPTION 'Missing permission sales.commission.pay' USING ERRCODE = '42501';
  END IF;

  v_commission_id := NULLIF(payload->>'commission_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_fin_acct := NULLIF(payload->>'financial_account_id', '')::uuid;

  IF v_commission_id IS NULL OR v_client_txn_key IS NULL OR v_fin_acct IS NULL THEN
    RAISE EXCEPTION 'commission_id, client_txn_key and financial_account_id are required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    WHERE ft.source_type = 'salesman_commission'
      AND ft.source_id = v_commission_id
      AND ft.status = 'posted'
      AND ft.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('commission_id', v_commission_id, 'idempotent', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payroll_commission_allocations pca
    WHERE pca.commission_id = v_commission_id AND pca.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Commission is allocated to payroll; pay via payroll instead';
  END IF;

  SELECT * INTO v_row
  FROM public.salesman_commissions sc
  WHERE sc.id = v_commission_id
    AND sc.organization_id = v_org_id
    AND sc.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Commission not found'; END IF;
  IF v_row.status = 'paid' THEN
    RETURN jsonb_build_object('commission_id', v_row.id, 'idempotent', true);
  END IF;
  IF v_row.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Commission cannot be paid from status %', v_row.status;
  END IF;

  IF v_row.employee_id IS NOT NULL THEN
    SELECT commission_payment_mode INTO v_mode
    FROM public.employees
    WHERE id = v_row.employee_id AND deleted_at IS NULL;
    IF v_mode = 'payroll' THEN
      RAISE EXCEPTION 'Employee commission_payment_mode is payroll; use payroll payment';
    END IF;
  END IF;

  IF v_row.status = 'pending' THEN
    UPDATE public.salesman_commissions
    SET status = 'approved',
        approved_at = v_now,
        approved_by = v_profile_id,
        updated_by = v_profile_id
    WHERE id = v_row.id;
  END IF;

  PERFORM public._post_financial_txn(
    v_org_id,
    v_row.branch_id,
    v_fin_acct,
    'commission_payment',
    'out',
    v_row.commission_amount,
    'salesman_commission',
    v_row.id,
    'Commission payment',
    COALESCE(NULLIF(payload->>'notes', ''), 'Sales commission payment'),
    v_profile_id,
    true
  );

  UPDATE public.salesman_commissions
  SET status = 'paid',
      paid_at = v_now,
      financial_account_id = v_fin_acct,
      notes = COALESCE(notes, '') || ' paid:' || v_client_txn_key,
      updated_by = v_profile_id
  WHERE id = v_row.id;

  RETURN jsonb_build_object('commission_id', v_row.id, 'status', 'paid', 'idempotent', false);
END;
$$;

--------------------------------------------------------------------------------
-- 2F. close_business_day: compute cash sales/collections (Asia/Dhaka day)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_business_day(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_closing_date date;
  v_opening_cash numeric(14, 2);
  v_cash_sales numeric(14, 2);
  v_cash_collections numeric(14, 2);
  v_other_cash_income numeric(14, 2);
  v_cash_expenses numeric(14, 2);
  v_supplier_cash_payments numeric(14, 2);
  v_cash_transfers_net numeric(14, 2);
  v_counted_cash numeric(14, 2);
  v_expected numeric(14, 2);
  v_difference numeric(14, 2);
  v_note text;
  v_diff_reason text;
  v_existing uuid;
  v_closing_id uuid;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_computed_in numeric(14, 2);
  v_computed_out numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('daily_closing.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission daily_closing.create or accounts.manage' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_closing_date := NULLIF(payload->>'closing_date', '')::date;
  v_counted_cash := coalesce(NULLIF(payload->>'counted_cash', '')::numeric, 0);
  v_note := NULLIF(payload->>'note', '');
  v_diff_reason := NULLIF(payload->>'difference_reason', '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_closing_date IS NULL THEN RAISE EXCEPTION 'closing_date is required'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing
  FROM public.daily_closings
  WHERE branch_id = v_branch_id
    AND closing_date = v_closing_date
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Daily closing already exists for branch % on %', v_branch_id, v_closing_date;
  END IF;

  v_day_start := (v_closing_date::timestamp AT TIME ZONE 'Asia/Dhaka');
  v_day_end := v_day_start + interval '1 day';

  IF payload ? 'opening_cash' AND NULLIF(payload->>'opening_cash', '') IS NOT NULL THEN
    v_opening_cash := (payload->>'opening_cash')::numeric;
  ELSE
    SELECT coalesce(sum(fa.opening_balance), 0) INTO v_opening_cash
    FROM public.financial_accounts fa
    WHERE fa.organization_id = v_org_id
      AND fa.deleted_at IS NULL
      AND fa.account_kind = 'cash'
      AND (fa.branch_id IS NULL OR fa.branch_id = v_branch_id);
  END IF;

  IF payload ? 'cash_sales' AND NULLIF(payload->>'cash_sales', '') IS NOT NULL THEN
    v_cash_sales := (payload->>'cash_sales')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_cash_sales
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND fa.account_kind = 'cash'
      AND ft.direction = 'in'
      AND ft.transaction_type IN ('sale_payment', 'pos_payment', 'sale')
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'cash_collections' AND NULLIF(payload->>'cash_collections', '') IS NOT NULL THEN
    v_cash_collections := (payload->>'cash_collections')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_cash_collections
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND fa.account_kind = 'cash'
      AND ft.direction = 'in'
      AND ft.transaction_type IN ('customer_due_collection', 'due_collection', 'collection')
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'other_cash_income' AND NULLIF(payload->>'other_cash_income', '') IS NOT NULL THEN
    v_other_cash_income := (payload->>'other_cash_income')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_other_cash_income
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.direction = 'in'
      AND ft.transaction_type IN ('income', 'other_income')
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'cash_expenses' AND NULLIF(payload->>'cash_expenses', '') IS NOT NULL THEN
    v_cash_expenses := (payload->>'cash_expenses')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_cash_expenses
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.direction = 'out'
      AND ft.transaction_type IN ('expense')
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'supplier_cash_payments' AND NULLIF(payload->>'supplier_cash_payments', '') IS NOT NULL THEN
    v_supplier_cash_payments := (payload->>'supplier_cash_payments')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_supplier_cash_payments
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND fa.account_kind = 'cash'
      AND ft.direction = 'out'
      AND ft.transaction_type IN ('supplier_payment', 'purchase_payment')
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'cash_transfers_net' AND NULLIF(payload->>'cash_transfers_net', '') IS NOT NULL THEN
    v_cash_transfers_net := (payload->>'cash_transfers_net')::numeric;
  ELSE
    SELECT
      coalesce(sum(CASE WHEN ft.direction = 'in' THEN ft.amount ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ft.direction = 'out' THEN ft.amount ELSE 0 END), 0)
    INTO v_computed_in, v_computed_out
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.transaction_type = 'transfer'
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
    v_cash_transfers_net := coalesce(v_computed_in, 0) - coalesce(v_computed_out, 0);
  END IF;

  v_expected := round(
    coalesce(v_opening_cash, 0)
    + coalesce(v_cash_sales, 0)
    + coalesce(v_cash_collections, 0)
    + coalesce(v_other_cash_income, 0)
    - coalesce(v_cash_expenses, 0)
    - coalesce(v_supplier_cash_payments, 0)
    + coalesce(v_cash_transfers_net, 0),
    2
  );

  IF payload ? 'expected_cash' AND NULLIF(payload->>'expected_cash', '') IS NOT NULL THEN
    v_expected := (payload->>'expected_cash')::numeric;
  ELSIF payload ? 'expected_closing' AND NULLIF(payload->>'expected_closing', '') IS NOT NULL THEN
    v_expected := (payload->>'expected_closing')::numeric;
  END IF;

  v_difference := round(v_counted_cash - v_expected, 2);

  IF abs(v_difference) > 0.01 AND (v_diff_reason IS NULL OR length(btrim(v_diff_reason)) = 0) THEN
    RAISE EXCEPTION 'difference_reason is required when |difference| > 0.01 (difference=%)',
      v_difference;
  END IF;

  IF v_diff_reason IS NOT NULL THEN
    v_note := coalesce(v_note || E'\n', '') || 'Difference reason: ' || v_diff_reason;
  END IF;

  INSERT INTO public.daily_closings (
    organization_id, branch_id, closing_date,
    opening_cash, cash_sales, cash_collections, other_cash_income,
    cash_expenses, supplier_cash_payments, cash_transfers_net,
    expected_closing, counted_cash, difference, note,
    closed_by, status, closed_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_closing_date,
    coalesce(v_opening_cash, 0), coalesce(v_cash_sales, 0),
    coalesce(v_cash_collections, 0), coalesce(v_other_cash_income, 0),
    coalesce(v_cash_expenses, 0), coalesce(v_supplier_cash_payments, 0),
    coalesce(v_cash_transfers_net, 0),
    v_expected, v_counted_cash, v_difference, v_note,
    v_profile_id, 'closed', timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_closing_id;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'daily_closing.create', 'daily_closing', v_closing_id,
    NULL,
    jsonb_build_object(
      'closing_date', v_closing_date,
      'expected_closing', v_expected,
      'counted_cash', v_counted_cash,
      'difference', v_difference
    ),
    v_diff_reason,
    jsonb_build_object('source', 'close_business_day')
  );

  RETURN v_closing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_business_day(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_business_day(jsonb) TO authenticated;
