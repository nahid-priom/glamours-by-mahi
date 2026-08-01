-- Migration 110: Contributor-aware commission reversal for returns & exchanges
--
-- Acceptance cases (manual):
-- 1) Two contributors → return only A's line → A reduced, B unchanged
-- 2) Full return → related commissions status=reversed, reversed_amount = original
-- 3) Exchange return + replacement → return lines reverse by contributor; actor accrues on replacements
-- 4) Double-complete same return → no double reverse (idempotent marker)
-- 5) Legacy single-key commission without sale_item_id links → grand_total fallback

--------------------------------------------------------------------------------
-- Schema: track original + reversed dollars
--------------------------------------------------------------------------------
ALTER TABLE public.salesman_commissions
  ADD COLUMN IF NOT EXISTS reversed_amount numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (reversed_amount >= 0),
  ADD COLUMN IF NOT EXISTS original_commission_amount numeric(14, 2);

UPDATE public.salesman_commissions
SET original_commission_amount = coalesce(original_commission_amount, commission_amount + coalesce(reversed_amount, 0))
WHERE original_commission_amount IS NULL
  AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS salesman_commissions_sale_profile_idx
  ON public.salesman_commissions (sale_id, profile_id)
  WHERE deleted_at IS NULL AND sale_id IS NOT NULL;

--------------------------------------------------------------------------------
-- Core: apply contributor-scoped reversals
-- p_contributor_bases: [{"profile_id":"<uuid>","returned_base":123.45}, ...]
-- Marker format appended to notes: " {marker_prefix}{source_id}:{amount}:{prev_status}"
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_contributor_commission_reversals(
  p_sale_id uuid,
  p_source_id uuid,
  p_marker_prefix text,
  p_source_type text,
  p_contributor_bases jsonb,
  p_fallback_total numeric DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_comm public.salesman_commissions%ROWTYPE;
  v_marker_token text;
  v_returned_base numeric(14, 2);
  v_ratio numeric(14, 6);
  v_reverse numeric(14, 2);
  v_remaining numeric(14, 2);
  v_original numeric(14, 2);
  v_active_base numeric(14, 2);
  v_has_contributor_map boolean := false;
  v_fallback_ratio numeric(14, 6);
  v_actor uuid := coalesce(p_actor, public.current_profile_id());
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_marker_token := p_marker_prefix || p_source_id::text;

  IF jsonb_typeof(p_contributor_bases) = 'array'
     AND jsonb_array_length(p_contributor_bases) > 0 THEN
    v_has_contributor_map := true;
  END IF;

  IF NOT v_has_contributor_map THEN
    IF coalesce(p_fallback_total, 0) <= 0 OR coalesce(v_sale.grand_total, 0) <= 0 THEN
      RETURN;
    END IF;
    v_fallback_ratio := least(greatest(p_fallback_total / v_sale.grand_total, 0), 1);
  END IF;

  FOR v_comm IN
    SELECT * FROM public.salesman_commissions sc
    WHERE sc.sale_id = p_sale_id
      AND sc.deleted_at IS NULL
      AND sc.status IN ('pending', 'approved', 'paid')
    FOR UPDATE
  LOOP
    IF coalesce(v_comm.notes, '') LIKE '%' || v_marker_token || '%' THEN
      CONTINUE;
    END IF;

    v_original := coalesce(
      v_comm.original_commission_amount,
      v_comm.commission_amount + coalesce(v_comm.reversed_amount, 0)
    );
    IF v_comm.original_commission_amount IS NULL THEN
      UPDATE public.salesman_commissions
      SET original_commission_amount = v_original
      WHERE id = v_comm.id;
    END IF;

    v_remaining := greatest(v_comm.commission_amount, 0);
    IF v_remaining <= 0 THEN
      CONTINUE;
    END IF;

    v_ratio := 0;
    v_returned_base := 0;

    IF v_has_contributor_map THEN
      SELECT coalesce((e.elem->>'returned_base')::numeric, 0)
      INTO v_returned_base
      FROM jsonb_array_elements(p_contributor_bases) AS e(elem)
      WHERE NULLIF(e.elem->>'profile_id', '')::uuid IS NOT DISTINCT FROM v_comm.profile_id
      LIMIT 1;

      IF coalesce(v_returned_base, 0) <= 0 THEN
        CONTINUE; -- this contributor's lines were not returned
      END IF;

      v_active_base := nullif(v_comm.base_amount, 0);
      IF v_active_base IS NULL THEN
        SELECT coalesce(sum(si.line_total), 0) INTO v_active_base
        FROM public.sale_items si
        WHERE si.sale_id = p_sale_id
          AND si.deleted_at IS NULL
          AND coalesce(si.contributor_profile_id, si.created_by) = v_comm.profile_id;
      END IF;

      IF coalesce(v_active_base, 0) <= 0 THEN
        CONTINUE;
      END IF;

      v_ratio := least(greatest(v_returned_base / v_active_base, 0), 1);
    ELSE
      v_ratio := v_fallback_ratio;
      v_returned_base := round(coalesce(v_comm.base_amount, 0) * v_ratio, 2);
    END IF;

    v_reverse := round(v_remaining * v_ratio, 2);
    IF v_reverse <= 0 THEN
      CONTINUE;
    END IF;

    IF v_comm.status = 'paid' AND v_comm.financial_account_id IS NOT NULL THEN
      PERFORM public._post_financial_txn(
        v_comm.organization_id,
        v_comm.branch_id,
        v_comm.financial_account_id,
        'commission_reversal',
        'in',
        v_reverse,
        p_source_type,
        p_source_id,
        'Commission reversal',
        'Commission reversal on ' || p_source_type,
        v_actor,
        true
      );
    END IF;

    UPDATE public.salesman_commissions
    SET original_commission_amount = v_original,
        reversed_amount = coalesce(reversed_amount, 0) + v_reverse,
        commission_amount = greatest(commission_amount - v_reverse, 0),
        base_amount = greatest(base_amount - coalesce(v_returned_base, 0), 0),
        status = CASE
          WHEN commission_amount - v_reverse <= 0 THEN 'reversed'
          ELSE status
        END,
        notes = trim(both FROM coalesce(notes, '') || ' '
          || v_marker_token || ':' || v_reverse::text || ':' || v_comm.status),
        sale_return_id = CASE
          WHEN p_source_type = 'sale_return' THEN p_source_id
          ELSE sale_return_id
        END,
        updated_at = timezone('utc', now()),
        updated_by = v_actor
    WHERE id = v_comm.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_contributor_commission_reversals(uuid, uuid, text, text, jsonb, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._apply_contributor_commission_reversals(uuid, uuid, text, text, jsonb, numeric, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Sale return reverse (same signature as 057 — trigger unchanged)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reverse_sale_commissions(
  p_sale_id uuid,
  p_return_id uuid,
  p_return_total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bases jsonb;
  v_linked int := 0;
BEGIN
  IF coalesce(p_return_total, 0) <= 0 THEN
    RETURN;
  END IF;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'profile_id', x.profile_id,
             'returned_base', x.returned_base
           )
         ), '[]'::jsonb),
         coalesce(sum(x.line_count), 0)
  INTO v_bases, v_linked
  FROM (
    SELECT
      coalesce(si.contributor_profile_id, si.created_by) AS profile_id,
      sum(sri.line_total) AS returned_base,
      count(*)::int AS line_count
    FROM public.sale_return_items sri
    JOIN public.sale_items si ON si.id = sri.sale_item_id AND si.deleted_at IS NULL
    WHERE sri.sale_return_id = p_return_id
      AND sri.deleted_at IS NULL
      AND sri.sale_item_id IS NOT NULL
      AND coalesce(si.contributor_profile_id, si.created_by) IS NOT NULL
    GROUP BY coalesce(si.contributor_profile_id, si.created_by)
  ) x;

  IF v_linked > 0 AND jsonb_array_length(v_bases) > 0 THEN
    PERFORM public._apply_contributor_commission_reversals(
      p_sale_id,
      p_return_id,
      'reversed:',
      'sale_return',
      v_bases,
      NULL,
      public.current_profile_id()
    );
  ELSE
    -- Legacy fallback: proportional by return total / sale grand_total
    PERFORM public._apply_contributor_commission_reversals(
      p_sale_id,
      p_return_id,
      'reversed:',
      'sale_return',
      '[]'::jsonb,
      p_return_total,
      public.current_profile_id()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._reverse_sale_commissions(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._reverse_sale_commissions(uuid, uuid, numeric) TO service_role;

--------------------------------------------------------------------------------
-- Exchange: reverse returned lines + accrue replacement for actor
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reverse_commissions_for_exchange(p_exchange_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exchange public.exchanges%ROWTYPE;
  v_bases jsonb;
  v_return_total numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_exchange
  FROM public.exchanges e
  WHERE e.id = p_exchange_id AND e.deleted_at IS NULL;

  IF NOT FOUND OR v_exchange.sale_id IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'profile_id', x.profile_id,
             'returned_base', x.returned_base
           )
         ), '[]'::jsonb)
  INTO v_bases
  FROM (
    SELECT
      coalesce(si.contributor_profile_id, si.created_by) AS profile_id,
      sum(ei.line_total) AS returned_base
    FROM public.exchange_items ei
    JOIN public.sale_items si ON si.id = ei.original_sale_item_id AND si.deleted_at IS NULL
    WHERE ei.exchange_id = p_exchange_id
      AND ei.deleted_at IS NULL
      AND ei.direction = 'return'
      AND ei.original_sale_item_id IS NOT NULL
      AND coalesce(si.contributor_profile_id, si.created_by) IS NOT NULL
    GROUP BY coalesce(si.contributor_profile_id, si.created_by)
  ) x;

  SELECT coalesce(sum(ei.line_total), 0)
  INTO v_return_total
  FROM public.exchange_items ei
  WHERE ei.exchange_id = p_exchange_id
    AND ei.deleted_at IS NULL
    AND ei.direction = 'return';

  IF jsonb_typeof(v_bases) = 'array' AND jsonb_array_length(v_bases) > 0 THEN
    PERFORM public._apply_contributor_commission_reversals(
      v_exchange.sale_id,
      p_exchange_id,
      'reversed:exch:',
      'exchange',
      v_bases,
      NULL,
      v_exchange.created_by
    );
  ELSIF v_return_total > 0 THEN
    PERFORM public._apply_contributor_commission_reversals(
      v_exchange.sale_id,
      p_exchange_id,
      'reversed:exch:',
      'exchange',
      '[]'::jsonb,
      v_return_total,
      v_exchange.created_by
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._reverse_commissions_for_exchange(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._reverse_commissions_for_exchange(uuid) TO service_role;

-- Accrue replacement commission to the staff who generated the exchange replacements
CREATE OR REPLACE FUNCTION public._accrue_exchange_replacement_commission(
  p_exchange_id uuid,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exchange public.exchanges%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_base numeric(14, 2) := 0;
  v_cogs numeric(14, 2) := 0;
  v_source text;
  v_key text;
  v_id uuid;
BEGIN
  SELECT * INTO v_exchange
  FROM public.exchanges e
  WHERE e.id = p_exchange_id AND e.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_exchange.sale_id AND s.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(sum(ei.line_total), 0),
         coalesce(sum(round(ei.qty * coalesce(pv.purchase_price, 0), 2)), 0)
  INTO v_base, v_cogs
  FROM public.exchange_items ei
  LEFT JOIN public.product_variants pv ON pv.id = ei.variant_id
  WHERE ei.exchange_id = p_exchange_id
    AND ei.deleted_at IS NULL
    AND ei.direction = 'replacement';

  IF v_base <= 0 OR p_actor IS NULL THEN
    RETURN NULL;
  END IF;

  v_source := coalesce(nullif(v_sale.order_source, ''), 'pos');
  v_key := 'exch-comm:' || p_exchange_id::text || ':' || p_actor::text;

  -- Reuse contributor accrual with custom key via temporary override:
  -- call internal insert path by setting client key through a thin wrapper below.
  v_id := public._accrue_contributor_commission_keyed(
    v_sale,
    p_actor,
    NULL,
    v_base,
    v_cogs,
    v_source,
    v_key,
    jsonb_build_object(
      'attribution_mode', 'exchange_replacement',
      'exchange_id', p_exchange_id,
      'exchange_no', v_exchange.exchange_no
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_exchange_replacement_commission(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_exchange_replacement_commission(uuid, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Keyed accrual (extends 109 with optional client_txn_key + snapshot merge)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._accrue_contributor_commission_keyed(
  p_sale public.sales,
  p_profile_id uuid,
  p_employee_id uuid,
  p_base_amount numeric,
  p_cogs_amount numeric,
  p_source text,
  p_client_txn_key text,
  p_extra_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rule public.salesman_commission_rules%ROWTYPE;
  v_amount numeric(14, 2) := 0;
  v_commission_id uuid;
  v_key text;
  v_sale_date date;
  v_now timestamptz := timezone('utc', now());
  v_period_start date;
  v_period_end date;
  v_volume numeric(14, 2) := 0;
  v_tier jsonb;
  v_profit numeric(14, 2);
  v_employee_id uuid := p_employee_id;
  v_profile_id uuid := p_profile_id;
  v_snapshot jsonb;
BEGIN
  IF v_profile_id IS NULL AND v_employee_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF coalesce(p_base_amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  IF v_employee_id IS NULL AND v_profile_id IS NOT NULL THEN
    SELECT e.id INTO v_employee_id
    FROM public.employees e
    WHERE e.profile_id = v_profile_id
      AND e.organization_id = p_sale.organization_id
      AND e.deleted_at IS NULL
      AND e.status <> 'terminated'
    ORDER BY e.created_at ASC
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL AND v_employee_id IS NOT NULL THEN
    SELECT e.profile_id INTO v_profile_id
    FROM public.employees e
    WHERE e.id = v_employee_id;
  END IF;

  v_sale_date := coalesce(p_sale.completed_at, p_sale.created_at)::date;
  v_key := coalesce(
    nullif(btrim(p_client_txn_key), ''),
    'sale-comm:' || p_sale.id::text || ':' || coalesce(v_profile_id, v_employee_id)::text
  );

  IF EXISTS (
    SELECT 1 FROM public.salesman_commissions sc
    WHERE sc.organization_id = p_sale.organization_id
      AND sc.client_txn_key = v_key
      AND sc.deleted_at IS NULL
  ) THEN
    SELECT id INTO v_commission_id
    FROM public.salesman_commissions
    WHERE organization_id = p_sale.organization_id
      AND client_txn_key = v_key AND deleted_at IS NULL
    LIMIT 1;
    RETURN v_commission_id;
  END IF;

  IF p_client_txn_key IS NULL AND EXISTS (
    SELECT 1 FROM public.salesman_commissions sc
    WHERE sc.organization_id = p_sale.organization_id
      AND sc.client_txn_key = 'sale-comm:' || p_sale.id::text
      AND sc.deleted_at IS NULL
      AND sc.profile_id IS NOT DISTINCT FROM v_profile_id
  ) THEN
    SELECT id INTO v_commission_id
    FROM public.salesman_commissions
    WHERE organization_id = p_sale.organization_id
      AND client_txn_key = 'sale-comm:' || p_sale.id::text
      AND deleted_at IS NULL
    LIMIT 1;
    RETURN v_commission_id;
  END IF;

  SELECT * INTO v_rule
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = p_sale.organization_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND r.effective_from <= v_sale_date
    AND (r.effective_to IS NULL OR r.effective_to >= v_sale_date)
    AND (r.branch_id IS NULL OR r.branch_id = p_sale.branch_id)
    AND p_source = ANY (r.applies_to_sources)
    AND (
      (r.subject_type = 'employee' AND v_employee_id IS NOT NULL AND r.employee_id = v_employee_id)
      OR (r.subject_type = 'profile' AND v_profile_id IS NOT NULL AND r.profile_id = v_profile_id)
      OR (
        r.subject_type IS DISTINCT FROM 'profile'
        AND v_employee_id IS NOT NULL
        AND r.employee_id = v_employee_id
      )
      OR (
        coalesce(r.subject_type, 'employee') = 'employee'
        AND r.employee_id IS NULL
        AND v_profile_id IS NOT NULL
        AND r.profile_id = v_profile_id
      )
    )
    AND (
      r.structure_mode IN ('sale_amount_tiers', 'period_volume_tiers')
      OR (r.rule_type <> 'none' AND r.rate > 0)
    )
  ORDER BY
    CASE WHEN r.subject_type = 'employee' AND r.employee_id IS NOT NULL THEN 0
         WHEN r.subject_type = 'profile' THEN 1
         ELSE 2 END,
    r.branch_id NULLS LAST,
    r.effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  v_profit := GREATEST(p_base_amount - coalesce(p_cogs_amount, 0), 0);

  IF v_rule.structure_mode = 'per_sale' THEN
    v_amount := CASE v_rule.rule_type
      WHEN 'fixed' THEN v_rule.rate
      WHEN 'percent_sale' THEN round(p_base_amount * (v_rule.rate / 100.0), 2)
      WHEN 'percent_profit' THEN round(v_profit * (v_rule.rate / 100.0), 2)
      ELSE 0
    END;
  ELSIF v_rule.structure_mode = 'sale_amount_tiers' THEN
    v_tier := public._pick_commission_tier(v_rule.tiers, p_base_amount);
    v_amount := public._calc_tier_commission(v_tier, p_base_amount, v_profit, v_rule.base_metric);
  ELSE
    v_period_start := date_trunc('month', v_sale_date)::date;
    v_period_end := (date_trunc('month', v_sale_date) + interval '1 month - 1 day')::date;

    SELECT coalesce(sum(si.line_total), 0) INTO v_volume
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.organization_id = p_sale.organization_id
      AND s.deleted_at IS NULL
      AND si.deleted_at IS NULL
      AND s.status = 'completed'
      AND coalesce(s.completed_at, s.created_at)::date BETWEEN v_period_start AND v_period_end
      AND coalesce(si.contributor_profile_id, si.created_by) = v_profile_id;

    v_tier := public._pick_commission_tier(v_rule.tiers, v_volume);
    v_amount := public._calc_tier_commission(v_tier, p_base_amount, v_profit, v_rule.base_metric);
  END IF;

  IF v_amount <= 0 THEN RETURN NULL; END IF;

  v_snapshot := jsonb_build_object(
    'rule_id', v_rule.id,
    'subject_type', v_rule.subject_type,
    'structure_mode', v_rule.structure_mode,
    'rule_type', v_rule.rule_type,
    'rate', v_rule.rate,
    'base_metric', v_rule.base_metric,
    'tiers', v_rule.tiers,
    'matched_tier', v_tier,
    'period_volume', CASE WHEN v_rule.structure_mode = 'period_volume_tiers' THEN v_volume ELSE NULL END,
    'order_source', p_source,
    'attribution_mode', 'line_contributor',
    'effective_from', v_rule.effective_from,
    'employee_id', v_rule.employee_id,
    'profile_id', v_rule.profile_id
  ) || coalesce(p_extra_snapshot, '{}'::jsonb);

  INSERT INTO public.salesman_commissions (
    organization_id, branch_id, profile_id, employee_id, sale_id,
    base_amount, cogs_amount, commission_amount, status,
    approved_at, approved_by,
    client_txn_key, rule_snapshot, needs_employee_link,
    original_commission_amount, reversed_amount,
    created_by, updated_by
  ) VALUES (
    p_sale.organization_id, p_sale.branch_id, v_profile_id, v_employee_id, p_sale.id,
    p_base_amount, coalesce(p_cogs_amount, 0), v_amount, 'approved',
    v_now, coalesce(p_sale.created_by, v_profile_id),
    v_key, v_snapshot, (v_employee_id IS NULL AND v_profile_id IS NOT NULL),
    v_amount, 0,
    coalesce(p_sale.created_by, v_profile_id), coalesce(p_sale.created_by, v_profile_id)
  )
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_contributor_commission_keyed(public.sales, uuid, uuid, numeric, numeric, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_contributor_commission_keyed(public.sales, uuid, uuid, numeric, numeric, text, text, jsonb) TO service_role;

-- Keep 109 signature as thin wrapper
CREATE OR REPLACE FUNCTION public._accrue_contributor_commission(
  p_sale public.sales,
  p_profile_id uuid,
  p_employee_id uuid,
  p_base_amount numeric,
  p_cogs_amount numeric,
  p_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public._accrue_contributor_commission_keyed(
    p_sale, p_profile_id, p_employee_id, p_base_amount, p_cogs_amount, p_source,
    NULL, '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._apply_exchange_commission_effects(
  p_exchange_id uuid,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public._reverse_commissions_for_exchange(p_exchange_id);
  PERFORM public._accrue_exchange_replacement_commission(p_exchange_id, p_actor);
END;
$$;

REVOKE ALL ON FUNCTION public._apply_exchange_commission_effects(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._apply_exchange_commission_effects(uuid, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Undo exchange commission effects (cancel)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._undo_exchange_commission_effects(
  p_exchange_id uuid,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_comm public.salesman_commissions%ROWTYPE;
  v_marker_token text := 'reversed:exch:' || p_exchange_id::text;
  v_part text;
  v_amount numeric(14, 2);
  v_prev_status text;
  v_restored numeric(14, 2);
BEGIN
  -- Cancel replacement accruals for this exchange
  FOR v_comm IN
    SELECT * FROM public.salesman_commissions sc
    WHERE sc.deleted_at IS NULL
      AND sc.client_txn_key LIKE 'exch-comm:' || p_exchange_id::text || ':%'
      AND sc.status IN ('pending', 'approved', 'paid', 'reversed')
    FOR UPDATE
  LOOP
    IF v_comm.status = 'paid'
       AND v_comm.financial_account_id IS NOT NULL
       AND coalesce(v_comm.commission_amount, 0) > 0 THEN
      PERFORM public._post_financial_txn(
        v_comm.organization_id,
        v_comm.branch_id,
        v_comm.financial_account_id,
        'commission_reversal',
        'in',
        v_comm.commission_amount,
        'exchange_cancel',
        p_exchange_id,
        'Exchange commission cancel',
        'Reverse exchange replacement commission',
        p_actor,
        true
      );
    END IF;

    UPDATE public.salesman_commissions
    SET status = 'cancelled',
        commission_amount = 0,
        reversed_amount = coalesce(original_commission_amount, commission_amount, 0),
        notes = trim(both FROM coalesce(notes, '') || ' cancelled:exch:' || p_exchange_id::text),
        updated_at = timezone('utc', now()),
        updated_by = p_actor
    WHERE id = v_comm.id;
  END LOOP;

  -- Restore amounts previously reversed by this exchange
  FOR v_comm IN
    SELECT * FROM public.salesman_commissions sc
    WHERE sc.deleted_at IS NULL
      AND coalesce(sc.notes, '') LIKE '%' || v_marker_token || '%'
    FOR UPDATE
  LOOP
    -- notes token: reversed:exch:{id}:{amount}:{prev_status}
    SELECT m[1]
    INTO v_part
    FROM regexp_matches(coalesce(v_comm.notes, ''), v_marker_token || ':([0-9]+(?:\.[0-9]+)?)(?::([a-z_]+))?', 'g') AS m
    LIMIT 1;

    IF v_part IS NULL THEN
      CONTINUE;
    END IF;

    v_amount := v_part::numeric;
    SELECT m[2]
    INTO v_prev_status
    FROM regexp_matches(coalesce(v_comm.notes, ''), v_marker_token || ':([0-9]+(?:\.[0-9]+)?):([a-z_]+)', 'g') AS m
    LIMIT 1;

    v_restored := least(v_amount, coalesce(v_comm.reversed_amount, 0));
    IF v_restored <= 0 THEN
      CONTINUE;
    END IF;

    IF v_comm.status = 'paid' OR v_prev_status = 'paid' THEN
      -- If it was paid and we clawed back via commission_reversal, re-pay out
      IF v_comm.financial_account_id IS NOT NULL THEN
        PERFORM public._post_financial_txn(
          v_comm.organization_id,
          v_comm.branch_id,
          v_comm.financial_account_id,
          'commission_payment',
          'out',
          v_restored,
          'exchange_cancel',
          p_exchange_id,
          'Restore commission after exchange cancel',
          'Restore commission after exchange cancel',
          p_actor,
          true
        );
      END IF;
    END IF;

    UPDATE public.salesman_commissions
    SET commission_amount = commission_amount + v_restored,
        reversed_amount = greatest(coalesce(reversed_amount, 0) - v_restored, 0),
        status = CASE
          WHEN coalesce(v_prev_status, '') IN ('pending', 'approved', 'paid') THEN v_prev_status
          WHEN status = 'reversed' AND commission_amount + v_restored > 0 THEN 'approved'
          ELSE status
        END,
        notes = trim(both FROM replace(coalesce(notes, ''), v_marker_token || ':' || v_part
          || CASE WHEN v_prev_status IS NOT NULL THEN ':' || v_prev_status ELSE '' END, '')
          || ' restored:exch:' || p_exchange_id::text),
        updated_at = timezone('utc', now()),
        updated_by = p_actor
    WHERE id = v_comm.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._undo_exchange_commission_effects(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._undo_exchange_commission_effects(uuid, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Patch complete / cancel exchange RPCs to call commission helpers
--------------------------------------------------------------------------------
DO $$
DECLARE
  d text;
BEGIN
  d := pg_get_functiondef('public.complete_product_exchange(jsonb)'::regprocedure);
  IF d IS NOT NULL AND position('_apply_exchange_commission_effects' IN d) = 0 THEN
    d := regexp_replace(
      d,
      'PERFORM public\.write_audit_log\(\s*v_org_id, v_branch_id, v_profile_id,\s*''exchange\.complete''',
      $r$PERFORM public._apply_exchange_commission_effects(v_exchange_id, v_profile_id);

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'exchange.complete'$r$,
      'n'
    );
    IF position('_apply_exchange_commission_effects' IN d) = 0 THEN
      -- Fallback: inject before final RETURN jsonb_build_object for complete
      d := replace(
        d,
        $r$RETURN jsonb_build_object(
    'exchange_id', v_exchange_id,
    'exchange_no', v_exchange_no,
    'difference', v_difference,
    'return_total', v_return_total,
    'replacement_total', v_replacement_total,
    'idempotent', false
  );$r$,
        $r$PERFORM public._apply_exchange_commission_effects(v_exchange_id, v_profile_id);

  RETURN jsonb_build_object(
    'exchange_id', v_exchange_id,
    'exchange_no', v_exchange_no,
    'difference', v_difference,
    'return_total', v_return_total,
    'replacement_total', v_replacement_total,
    'idempotent', false
  );$r$
      );
    END IF;
    IF position('_apply_exchange_commission_effects' IN d) = 0 THEN
      RAISE EXCEPTION 'Failed to patch complete_product_exchange for commission effects';
    END IF;
    EXECUTE d;
  END IF;

  d := pg_get_functiondef('public.cancel_product_exchange(jsonb)'::regprocedure);
  IF d IS NOT NULL AND position('_undo_exchange_commission_effects' IN d) = 0 THEN
    d := regexp_replace(
      d,
      'PERFORM public\.write_audit_log\(\s*v_org_id, v_exchange\.branch_id, v_profile_id,\s*''exchange\.cancel''',
      $r$PERFORM public._undo_exchange_commission_effects(v_exchange.id, v_profile_id);

  PERFORM public.write_audit_log(
    v_org_id, v_exchange.branch_id, v_profile_id,
    'exchange.cancel'$r$,
      'n'
    );
    IF position('_undo_exchange_commission_effects' IN d) = 0 THEN
      d := replace(
        d,
        $r$UPDATE public.exchanges
  SET status = 'cancelled',$r$,
        $r$PERFORM public._undo_exchange_commission_effects(v_exchange.id, v_profile_id);

  UPDATE public.exchanges
  SET status = 'cancelled',$r$
      );
    END IF;
    IF position('_undo_exchange_commission_effects' IN d) = 0 THEN
      RAISE EXCEPTION 'Failed to patch cancel_product_exchange for commission undo';
    END IF;
    EXECUTE d;
  END IF;
END $$;

--------------------------------------------------------------------------------
-- Staff commission summary: reversed = sum(reversed_amount)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_commission_summary(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_staff uuid;
  v_month_start timestamptz := date_trunc('month', timezone('utc', now()));
  v_today_start timestamptz := date_trunc('day', timezone('utc', now()));
  v_week_start timestamptz := date_trunc('week', timezone('utc', now()));
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('staff.commission.read_own')
    OR public.user_has_permission('sales.commission.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_staff := coalesce(NULLIF(payload->>'staff_user_id', '')::uuid, v_profile_id);
  IF v_staff <> v_profile_id
     AND NOT (
       public.user_has_permission('sales.commission.manage')
       OR public.user_has_permission('settings.manage')
     ) THEN
    RAISE EXCEPTION 'Cannot view another staff commission' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH c AS (
      SELECT * FROM public.salesman_commissions sc
      WHERE sc.organization_id = v_org_id AND sc.deleted_at IS NULL
        AND (sc.profile_id = v_staff OR sc.employee_id IN (
          SELECT e.id FROM public.employees e WHERE e.profile_id = v_staff AND e.deleted_at IS NULL
        ))
        AND sc.status <> 'cancelled'
    )
    SELECT jsonb_build_object(
      'today', coalesce((SELECT sum(commission_amount) FROM c WHERE created_at >= v_today_start AND status IN ('pending','approved','paid')), 0),
      'week', coalesce((SELECT sum(commission_amount) FROM c WHERE created_at >= v_week_start AND status IN ('pending','approved','paid')), 0),
      'month', coalesce((SELECT sum(commission_amount) FROM c WHERE created_at >= v_month_start AND status IN ('pending','approved','paid')), 0),
      'pending', coalesce((SELECT sum(commission_amount) FROM c WHERE status = 'pending'), 0),
      'approved', coalesce((SELECT sum(commission_amount) FROM c WHERE status = 'approved'), 0),
      'paid', coalesce((SELECT sum(commission_amount) FROM c WHERE status = 'paid'), 0),
      'reversed', coalesce((SELECT sum(coalesce(reversed_amount, 0)) FROM c WHERE coalesce(reversed_amount, 0) > 0 OR status = 'reversed'), 0),
      'last_paid_at', (SELECT max(paid_at) FROM c WHERE status = 'paid')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_commission_summary(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_staff_commission_entries(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_staff uuid;
  v_page int := greatest(coalesce((payload->>'page')::int, 1), 1);
  v_page_size int := least(greatest(coalesce((payload->>'page_size')::int, 20), 1), 100);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('staff.commission.read_own')
    OR public.user_has_permission('sales.commission.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_staff := coalesce(NULLIF(payload->>'staff_user_id', '')::uuid, v_profile_id);
  IF v_staff <> v_profile_id
     AND NOT (
       public.user_has_permission('sales.commission.manage')
       OR public.user_has_permission('settings.manage')
     ) THEN
    RAISE EXCEPTION 'Cannot view another staff commission' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'items', coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT
          sc.id,
          sc.sale_id,
          sc.commission_amount,
          sc.reversed_amount,
          sc.original_commission_amount,
          sc.base_amount,
          sc.status,
          sc.created_at,
          sc.approved_at,
          sc.paid_at,
          s.invoice_no,
          s.grand_total,
          c.name AS customer_name
        FROM public.salesman_commissions sc
        LEFT JOIN public.sales s ON s.id = sc.sale_id
        LEFT JOIN public.customers c ON c.id = s.customer_id
        WHERE sc.organization_id = v_org_id AND sc.deleted_at IS NULL
          AND (sc.profile_id = v_staff OR sc.employee_id IN (
            SELECT e.id FROM public.employees e WHERE e.profile_id = v_staff AND e.deleted_at IS NULL
          ))
          AND (NULLIF(payload->>'status', '') IS NULL OR sc.status = payload->>'status')
        ORDER BY sc.created_at DESC
        OFFSET (v_page - 1) * v_page_size
        LIMIT v_page_size
      ) r
    ), '[]'::jsonb),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_commission_entries(jsonb) TO authenticated;
