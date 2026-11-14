-- Fix: Postgres has no max(uuid). _accrue_sale_commission grouped contributors with
-- max(si.contributor_employee_id), which fails on POS complete with SQLSTATE 42883.
-- Prefer any non-null contributor_employee_id via array_agg (same pattern as dashboard low-stock).

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
      (array_agg(si.contributor_employee_id) FILTER (WHERE si.contributor_employee_id IS NOT NULL))[1] AS employee_id,
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
