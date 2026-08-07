-- Migration 118: True per-sale-line commission ledger + staff report fields

--------------------------------------------------------------------------------
-- Schema
--------------------------------------------------------------------------------
ALTER TABLE public.salesman_commissions
  ADD COLUMN IF NOT EXISTS sale_item_id uuid REFERENCES public.sale_items (id),
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS variant_name text,
  ADD COLUMN IF NOT EXISTS qty numeric(14, 3),
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'sale';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salesman_commissions_event_type_chk'
  ) THEN
    ALTER TABLE public.salesman_commissions
      ADD CONSTRAINT salesman_commissions_event_type_chk
      CHECK (event_type IN (
        'sale',
        'return_reverse',
        'exchange_reverse',
        'exchange_replacement'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS salesman_commissions_sale_item_idx
  ON public.salesman_commissions (sale_item_id)
  WHERE deleted_at IS NULL AND sale_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS salesman_commissions_event_type_idx
  ON public.salesman_commissions (organization_id, event_type)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- Keyed accrual with line metadata (from p_extra_snapshot + optional force amount)
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
  v_extra jsonb := coalesce(p_extra_snapshot, '{}'::jsonb);
  v_sale_item_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_product_name text;
  v_variant_name text;
  v_qty numeric(14, 3);
  v_event_type text;
  v_force_amount numeric(14, 2);
  v_skip_rule_calc boolean := false;
BEGIN
  IF v_profile_id IS NULL AND v_employee_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF coalesce(p_base_amount, 0) <= 0 AND v_extra->>'force_commission_amount' IS NULL THEN
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

  -- Skip if legacy whole-sale key exists for same profile (pre-line ledger)
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

  v_sale_item_id := NULLIF(v_extra->>'sale_item_id', '')::uuid;
  v_product_id := NULLIF(v_extra->>'product_id', '')::uuid;
  v_variant_id := NULLIF(v_extra->>'variant_id', '')::uuid;
  v_product_name := NULLIF(v_extra->>'product_name', '');
  v_variant_name := NULLIF(v_extra->>'variant_name', '');
  v_qty := NULLIF(v_extra->>'qty', '')::numeric;
  v_event_type := coalesce(NULLIF(v_extra->>'event_type', ''), 'sale');
  IF v_extra ? 'force_commission_amount' THEN
    v_force_amount := coalesce((v_extra->>'force_commission_amount')::numeric, 0);
    v_skip_rule_calc := true;
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

  v_profit := GREATEST(coalesce(p_base_amount, 0) - coalesce(p_cogs_amount, 0), 0);

  IF v_skip_rule_calc THEN
    v_amount := v_force_amount;
  ELSIF v_rule.structure_mode = 'per_sale' THEN
    v_amount := CASE v_rule.rule_type
      WHEN 'fixed' THEN v_rule.rate
      WHEN 'percent_sale' THEN round(p_base_amount * (v_rule.rate / 100.0), 2)
      WHEN 'percent_profit' THEN round(v_profit * (v_rule.rate / 100.0), 2)
      ELSE 0
    END;
  ELSIF v_rule.structure_mode = 'sale_amount_tiers' THEN
    v_tier := public._pick_commission_tier(
      v_rule.tiers,
      coalesce((v_extra->>'tier_band_amount')::numeric, p_base_amount)
    );
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
    'profile_id', v_rule.profile_id,
    'sale_item_id', v_sale_item_id
  ) || v_extra;

  INSERT INTO public.salesman_commissions (
    organization_id, branch_id, profile_id, employee_id, sale_id,
    sale_item_id, product_id, variant_id, product_name, variant_name, qty, event_type,
    base_amount, cogs_amount, commission_amount, status,
    approved_at, approved_by,
    client_txn_key, rule_snapshot, needs_employee_link,
    original_commission_amount, reversed_amount,
    created_by, updated_by
  ) VALUES (
    p_sale.organization_id, p_sale.branch_id, v_profile_id, v_employee_id, p_sale.id,
    v_sale_item_id, v_product_id, v_variant_id, v_product_name, v_variant_name, v_qty, v_event_type,
    coalesce(p_base_amount, 0), coalesce(p_cogs_amount, 0), v_amount, 'approved',
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

--------------------------------------------------------------------------------
-- Accrue per sale_item (split fixed/tier-fixed by line share)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._accrue_sale_commission(p_sale_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_source text;
  v_first uuid;
  v_id uuid;
  v_contrib record;
  v_line record;
  v_rule public.salesman_commission_rules%ROWTYPE;
  v_sale_date date;
  v_contrib_base numeric(14, 2);
  v_contrib_cogs numeric(14, 2);
  v_contrib_profit numeric(14, 2);
  v_total_amount numeric(14, 2);
  v_tier jsonb;
  v_volume numeric(14, 2) := 0;
  v_period_start date;
  v_period_end date;
  v_is_fixed boolean;
  v_line_share numeric(14, 6);
  v_line_amount numeric(14, 2);
  v_allocated numeric(14, 2) := 0;
  v_lines_count int;
  v_line_idx int;
  v_product_name text;
  v_variant_name text;
  v_product_id uuid;
  v_fallback_profile uuid;
  v_fallback_employee uuid;
  v_has_lines boolean := false;
  v_meta jsonb;
BEGIN
  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.deleted_at IS NULL;

  IF NOT FOUND OR v_sale.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  IF coalesce(v_sale.fulfilment_status, '') = 'cancelled' THEN
    RETURN NULL;
  END IF;

  v_source := coalesce(nullif(v_sale.order_source, ''), 'pos');
  v_sale_date := coalesce(v_sale.completed_at, v_sale.created_at)::date;

  FOR v_contrib IN
    SELECT
      coalesce(si.contributor_profile_id, si.created_by) AS profile_id,
      max(si.contributor_employee_id) AS employee_id,
      sum(si.line_total) AS base_amount,
      coalesce(sum(round(si.qty * coalesce(si.cost_price, 0), 2)), 0) AS cogs_amount,
      count(*)::int AS line_count
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
      AND si.deleted_at IS NULL
      AND coalesce(si.contributor_profile_id, si.created_by) IS NOT NULL
    GROUP BY coalesce(si.contributor_profile_id, si.created_by)
  LOOP
    v_has_lines := true;
    v_contrib_base := v_contrib.base_amount;
    v_contrib_cogs := v_contrib.cogs_amount;
    v_contrib_profit := GREATEST(v_contrib_base - v_contrib_cogs, 0);

    SELECT * INTO v_rule
    FROM public.salesman_commission_rules r
    WHERE r.organization_id = v_sale.organization_id
      AND r.is_active = true
      AND r.deleted_at IS NULL
      AND r.effective_from <= v_sale_date
      AND (r.effective_to IS NULL OR r.effective_to >= v_sale_date)
      AND (r.branch_id IS NULL OR r.branch_id = v_sale.branch_id)
      AND v_source = ANY (r.applies_to_sources)
      AND (
        (r.subject_type = 'employee' AND v_contrib.employee_id IS NOT NULL AND r.employee_id = v_contrib.employee_id)
        OR (r.subject_type = 'profile' AND v_contrib.profile_id IS NOT NULL AND r.profile_id = v_contrib.profile_id)
        OR (
          r.subject_type IS DISTINCT FROM 'profile'
          AND v_contrib.employee_id IS NOT NULL
          AND r.employee_id = v_contrib.employee_id
        )
        OR (
          coalesce(r.subject_type, 'employee') = 'employee'
          AND r.employee_id IS NULL
          AND v_contrib.profile_id IS NOT NULL
          AND r.profile_id = v_contrib.profile_id
        )
        OR (
          r.subject_type = 'employee'
          AND r.employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.profile_id = v_contrib.profile_id
              AND e.organization_id = v_sale.organization_id
              AND e.deleted_at IS NULL
          )
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

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_is_fixed := false;
    v_total_amount := 0;
    v_tier := NULL;

    IF v_rule.structure_mode = 'per_sale' THEN
      IF v_rule.rule_type = 'fixed' THEN
        v_is_fixed := true;
        v_total_amount := v_rule.rate;
      END IF;
    ELSIF v_rule.structure_mode = 'sale_amount_tiers' THEN
      v_tier := public._pick_commission_tier(v_rule.tiers, v_contrib_base);
      IF lower(btrim(coalesce(v_tier->>'rate_type', 'percent'))) = 'fixed' THEN
        v_is_fixed := true;
        v_total_amount := public._calc_tier_commission(v_tier, v_contrib_base, v_contrib_profit, v_rule.base_metric);
      END IF;
    ELSE
      v_period_start := date_trunc('month', v_sale_date)::date;
      v_period_end := (date_trunc('month', v_sale_date) + interval '1 month - 1 day')::date;
      SELECT coalesce(sum(si.line_total), 0) INTO v_volume
      FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
      WHERE s.organization_id = v_sale.organization_id
        AND s.deleted_at IS NULL
        AND si.deleted_at IS NULL
        AND s.status = 'completed'
        AND coalesce(s.completed_at, s.created_at)::date BETWEEN v_period_start AND v_period_end
        AND coalesce(si.contributor_profile_id, si.created_by) = v_contrib.profile_id;
      v_tier := public._pick_commission_tier(v_rule.tiers, v_volume);
      IF lower(btrim(coalesce(v_tier->>'rate_type', 'percent'))) = 'fixed' THEN
        v_is_fixed := true;
        v_total_amount := public._calc_tier_commission(v_tier, v_contrib_base, v_contrib_profit, v_rule.base_metric);
      END IF;
    END IF;

    v_lines_count := v_contrib.line_count;
    v_line_idx := 0;
    v_allocated := 0;

    FOR v_line IN
      SELECT
        si.id AS sale_item_id,
        si.variant_id,
        si.qty,
        si.line_total,
        round(si.qty * coalesce(si.cost_price, 0), 2) AS cogs_amount,
        pv.product_id,
        p.name AS product_name,
        coalesce(pv.name, pv.sku) AS variant_name
      FROM public.sale_items si
      JOIN public.product_variants pv ON pv.id = si.variant_id
      JOIN public.products p ON p.id = pv.product_id
      WHERE si.sale_id = p_sale_id
        AND si.deleted_at IS NULL
        AND coalesce(si.contributor_profile_id, si.created_by) = v_contrib.profile_id
      ORDER BY si.created_at ASC, si.id ASC
    LOOP
      v_line_idx := v_line_idx + 1;
      v_product_id := v_line.product_id;
      v_product_name := v_line.product_name;
      v_variant_name := v_line.variant_name;

      IF v_is_fixed THEN
        IF v_line_idx = v_lines_count THEN
          v_line_amount := round(v_total_amount - v_allocated, 2);
        ELSE
          v_line_share := CASE WHEN v_contrib_base > 0 THEN v_line.line_total / v_contrib_base ELSE 0 END;
          v_line_amount := round(v_total_amount * v_line_share, 2);
          v_allocated := v_allocated + v_line_amount;
        END IF;
        v_meta := jsonb_build_object(
          'sale_item_id', v_line.sale_item_id,
          'product_id', v_product_id,
          'variant_id', v_line.variant_id,
          'product_name', v_product_name,
          'variant_name', v_variant_name,
          'qty', v_line.qty,
          'event_type', 'sale',
          'force_commission_amount', v_line_amount,
          'tier_band_amount', v_contrib_base,
          'matched_tier', v_tier,
          'period_volume', CASE WHEN v_rule.structure_mode = 'period_volume_tiers' THEN v_volume ELSE NULL END
        );
      ELSE
        v_meta := jsonb_build_object(
          'sale_item_id', v_line.sale_item_id,
          'product_id', v_product_id,
          'variant_id', v_line.variant_id,
          'product_name', v_product_name,
          'variant_name', v_variant_name,
          'qty', v_line.qty,
          'event_type', 'sale',
          'tier_band_amount', v_contrib_base,
          'matched_tier', v_tier,
          'period_volume', CASE WHEN v_rule.structure_mode = 'period_volume_tiers' THEN v_volume ELSE NULL END
        );
      END IF;

      v_id := public._accrue_contributor_commission_keyed(
        v_sale,
        v_contrib.profile_id,
        v_contrib.employee_id,
        v_line.line_total,
        v_line.cogs_amount,
        v_source,
        'sale-comm:' || p_sale_id::text || ':' || v_line.sale_item_id::text || ':' || v_contrib.profile_id::text,
        v_meta
      );
      IF v_first IS NULL THEN
        v_first := v_id;
      END IF;
    END LOOP;
  END LOOP;

  IF v_has_lines THEN
    RETURN v_first;
  END IF;

  v_fallback_employee := v_sale.salesperson_employee_id;
  v_fallback_profile := coalesce(
    v_sale.salesperson_id,
    v_sale.moderator_id,
    v_sale.created_by,
    v_sale.tele_salesman_id
  );

  RETURN public._accrue_contributor_commission(
    v_sale,
    v_fallback_profile,
    v_fallback_employee,
    v_sale.grand_total,
    (
      SELECT coalesce(sum(round(si.qty * coalesce(si.cost_price, 0), 2)), 0)
      FROM public.sale_items si
      WHERE si.sale_id = p_sale_id AND si.deleted_at IS NULL
    ),
    v_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_sale_commission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_sale_commission(uuid) TO service_role;

--------------------------------------------------------------------------------
-- Line-aware reversals
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
  v_has_item_map boolean := false;
  v_fallback_ratio numeric(14, 6);
  v_actor uuid := coalesce(p_actor, public.current_profile_id());
  v_event text;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_marker_token := p_marker_prefix || p_source_id::text;
  v_event := CASE
    WHEN p_source_type = 'exchange' THEN 'exchange_reverse'
    WHEN p_source_type = 'sale_return' THEN 'return_reverse'
    ELSE NULL
  END;

  IF jsonb_typeof(p_contributor_bases) = 'array'
     AND jsonb_array_length(p_contributor_bases) > 0 THEN
    v_has_contributor_map := true;
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_contributor_bases) e(elem)
      WHERE NULLIF(e.elem->>'sale_item_id', '') IS NOT NULL
    ) INTO v_has_item_map;
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
      AND sc.event_type IN ('sale', 'exchange_replacement')
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

    IF v_has_item_map AND v_comm.sale_item_id IS NOT NULL THEN
      SELECT coalesce((e.elem->>'returned_base')::numeric, 0)
      INTO v_returned_base
      FROM jsonb_array_elements(p_contributor_bases) AS e(elem)
      WHERE NULLIF(e.elem->>'sale_item_id', '')::uuid = v_comm.sale_item_id
      LIMIT 1;

      IF coalesce(v_returned_base, 0) <= 0 THEN
        CONTINUE;
      END IF;

      v_active_base := nullif(v_comm.base_amount, 0);
      IF coalesce(v_active_base, 0) <= 0 THEN
        CONTINUE;
      END IF;
      v_ratio := least(greatest(v_returned_base / v_active_base, 0), 1);
    ELSIF v_has_contributor_map THEN
      -- Legacy aggregated contributor map (no sale_item_id on commission or payload)
      IF v_comm.sale_item_id IS NOT NULL AND v_has_item_map THEN
        CONTINUE;
      END IF;

      SELECT coalesce((e.elem->>'returned_base')::numeric, 0)
      INTO v_returned_base
      FROM jsonb_array_elements(p_contributor_bases) AS e(elem)
      WHERE NULLIF(e.elem->>'profile_id', '')::uuid IS NOT DISTINCT FROM v_comm.profile_id
        AND NULLIF(e.elem->>'sale_item_id', '') IS NULL
      LIMIT 1;

      IF coalesce(v_returned_base, 0) <= 0 THEN
        -- Sum item-level returned bases for this profile when only item rows exist
        SELECT coalesce(sum((e.elem->>'returned_base')::numeric), 0)
        INTO v_returned_base
        FROM jsonb_array_elements(p_contributor_bases) AS e(elem)
        WHERE NULLIF(e.elem->>'profile_id', '')::uuid IS NOT DISTINCT FROM v_comm.profile_id;

        IF coalesce(v_returned_base, 0) <= 0 THEN
          CONTINUE;
        END IF;
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
        event_type = CASE
          WHEN commission_amount - v_reverse <= 0 AND v_event IS NOT NULL THEN v_event
          ELSE event_type
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
             'sale_item_id', x.sale_item_id,
             'returned_base', x.returned_base
           )
         ), '[]'::jsonb),
         coalesce(sum(x.line_count), 0)
  INTO v_bases, v_linked
  FROM (
    SELECT
      coalesce(si.contributor_profile_id, si.created_by) AS profile_id,
      sri.sale_item_id,
      sum(sri.line_total) AS returned_base,
      count(*)::int AS line_count
    FROM public.sale_return_items sri
    JOIN public.sale_items si ON si.id = sri.sale_item_id AND si.deleted_at IS NULL
    WHERE sri.sale_return_id = p_return_id
      AND sri.deleted_at IS NULL
      AND sri.sale_item_id IS NOT NULL
      AND coalesce(si.contributor_profile_id, si.created_by) IS NOT NULL
    GROUP BY coalesce(si.contributor_profile_id, si.created_by), sri.sale_item_id
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
             'sale_item_id', x.sale_item_id,
             'returned_base', x.returned_base
           )
         ), '[]'::jsonb)
  INTO v_bases
  FROM (
    SELECT
      coalesce(si.contributor_profile_id, si.created_by) AS profile_id,
      ei.original_sale_item_id AS sale_item_id,
      sum(ei.line_total) AS returned_base
    FROM public.exchange_items ei
    JOIN public.sale_items si ON si.id = ei.original_sale_item_id AND si.deleted_at IS NULL
    WHERE ei.exchange_id = p_exchange_id
      AND ei.deleted_at IS NULL
      AND ei.direction = 'return'
      AND ei.original_sale_item_id IS NOT NULL
      AND coalesce(si.contributor_profile_id, si.created_by) IS NOT NULL
    GROUP BY coalesce(si.contributor_profile_id, si.created_by), ei.original_sale_item_id
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

--------------------------------------------------------------------------------
-- Exchange replacement: one commission row per replacement line
--------------------------------------------------------------------------------
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
  v_source text;
  v_id uuid;
  v_first uuid;
  v_line record;
  v_employee_id uuid;
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
  IF NOT FOUND OR p_actor IS NULL THEN
    RETURN NULL;
  END IF;

  v_source := coalesce(nullif(v_sale.order_source, ''), 'pos');

  SELECT e.id INTO v_employee_id
  FROM public.employees e
  WHERE e.profile_id = p_actor
    AND e.organization_id = v_sale.organization_id
    AND e.deleted_at IS NULL
    AND e.status <> 'terminated'
  ORDER BY e.created_at ASC
  LIMIT 1;

  FOR v_line IN
    SELECT
      ei.id AS exchange_item_id,
      ei.variant_id,
      ei.qty,
      ei.line_total,
      round(ei.qty * coalesce(pv.purchase_price, 0), 2) AS cogs_amount,
      pv.product_id,
      p.name AS product_name,
      coalesce(pv.name, pv.sku) AS variant_name
    FROM public.exchange_items ei
    JOIN public.product_variants pv ON pv.id = ei.variant_id
    JOIN public.products p ON p.id = pv.product_id
    WHERE ei.exchange_id = p_exchange_id
      AND ei.deleted_at IS NULL
      AND ei.direction = 'replacement'
      AND ei.line_total > 0
  LOOP
    v_id := public._accrue_contributor_commission_keyed(
      v_sale,
      p_actor,
      v_employee_id,
      v_line.line_total,
      v_line.cogs_amount,
      v_source,
      'exch-comm:' || p_exchange_id::text || ':' || v_line.exchange_item_id::text || ':' || p_actor::text,
      jsonb_build_object(
        'attribution_mode', 'exchange_replacement',
        'exchange_id', p_exchange_id,
        'exchange_no', v_exchange.exchange_no,
        'exchange_item_id', v_line.exchange_item_id,
        'product_id', v_line.product_id,
        'variant_id', v_line.variant_id,
        'product_name', v_line.product_name,
        'variant_name', v_line.variant_name,
        'qty', v_line.qty,
        'event_type', 'exchange_replacement'
      )
    );
    IF v_first IS NULL THEN
      v_first := v_id;
    END IF;
  END LOOP;

  RETURN v_first;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_exchange_replacement_commission(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_exchange_replacement_commission(uuid, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Staff list RPC with product + event_type filter
--------------------------------------------------------------------------------
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
  v_event text := nullif(btrim(coalesce(payload->>'event_type', '')), '');
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

  IF v_event IS NOT NULL AND v_event NOT IN (
    'all', 'sale', 'return_reverse', 'exchange_reverse', 'exchange_replacement'
  ) THEN
    v_event := 'all';
  END IF;
  IF v_event = 'all' THEN
    v_event := NULL;
  END IF;

  RETURN jsonb_build_object(
    'items', coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT
          sc.id,
          sc.sale_id,
          sc.sale_item_id,
          sc.product_id,
          sc.variant_id,
          sc.product_name,
          sc.variant_name,
          sc.qty,
          sc.event_type,
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
          AND (
            v_event IS NULL
            OR sc.event_type = v_event
            OR (
              v_event = 'return_reverse'
              AND (
                sc.event_type = 'return_reverse'
                OR sc.sale_return_id IS NOT NULL
                OR (
                  coalesce(sc.reversed_amount, 0) > 0
                  AND coalesce(sc.notes, '') LIKE '%reversed:%'
                  AND coalesce(sc.notes, '') NOT LIKE '%reversed:exch:%'
                )
              )
            )
            OR (
              v_event = 'exchange_reverse'
              AND (
                sc.event_type = 'exchange_reverse'
                OR coalesce(sc.notes, '') LIKE '%reversed:exch:%'
              )
            )
          )
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
