-- Migration 151: Restore sale_item_id-aware commission clawback (forward-only).
-- Root cause: migration 133 rewrote _apply_contributor_commission_reversals to match
-- only profile_id + LIMIT 1, ignoring sale_item_id payloads still emitted by
-- _reverse_sale_commissions / exchange helpers (migration 118). Multi-line partial
-- returns for the same contributor could over-reverse.
--
-- Preserves V4 (133) behavior:
--   - FOR UPDATE row locks
--   - Policy 2A: fixed per-sale reverses only on full return
--   - recoverable_amount for paid clawbacks (no phantom cash credit)
--   - original_commission_amount tracking
--   - cumulative entitlement cap
-- Restores from 118:
--   - sale_item_id-first matching when payload has item map
--   - event_type return_reverse / exchange_reverse on full reverse
--   - event_type filter on sale / exchange_replacement rows

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
  v_already_reversed numeric(14, 2);
  v_active_base numeric(14, 2);
  v_has_contributor_map boolean := false;
  v_has_item_map boolean := false;
  v_fallback_ratio numeric(14, 6);
  v_actor uuid := coalesce(p_actor, public.current_profile_id());
  v_is_full boolean := false;
  v_returned_sale_total numeric(14, 2) := 0;
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
    v_is_full := v_fallback_ratio >= 0.999;
  ELSE
    SELECT coalesce(sum((e.elem->>'returned_base')::numeric), 0)
    INTO v_returned_sale_total
    FROM jsonb_array_elements(p_contributor_bases) AS e(elem);
    v_is_full := coalesce(v_sale.grand_total, 0) > 0
      AND v_returned_sale_total >= (v_sale.grand_total * 0.999);
  END IF;

  FOR v_comm IN
    SELECT * FROM public.salesman_commissions sc
    WHERE sc.sale_id = p_sale_id
      AND sc.deleted_at IS NULL
      AND sc.status IN ('pending', 'approved', 'paid')
      AND coalesce(sc.event_type, 'sale') IN ('sale', 'exchange_replacement')
    FOR UPDATE
  LOOP
    IF coalesce(v_comm.notes, '') LIKE '%' || v_marker_token || '%' THEN
      CONTINUE;
    END IF;

    -- Policy 2A: fixed per-sale reverses only on full return/void (ratio ~1)
    IF p_source_type = 'sale_return'
       AND public._commission_is_fixed_per_sale(v_comm.rule_snapshot)
       AND NOT v_is_full THEN
      CONTINUE;
    END IF;

    v_already_reversed := coalesce(v_comm.reversed_amount, 0);
    v_original := coalesce(
      v_comm.original_commission_amount,
      v_comm.commission_amount + v_already_reversed
    );
    IF v_comm.original_commission_amount IS NULL THEN
      UPDATE public.salesman_commissions
      SET original_commission_amount = v_original
      WHERE id = v_comm.id;
    END IF;

    v_remaining := greatest(
      least(v_comm.commission_amount, v_original - v_already_reversed),
      0
    );
    IF v_remaining <= 0 THEN
      CONTINUE;
    END IF;

    v_ratio := 0;
    v_returned_base := 0;

    IF v_has_item_map AND v_comm.sale_item_id IS NOT NULL THEN
      -- Line-level match (authoritative path for per-line ledger rows)
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
      -- Cap returned_base to active base so base_amount never goes negative via overshoot
      v_returned_base := least(v_returned_base, v_active_base);
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
      v_returned_base := round(coalesce(v_comm.base_amount, 0) * v_ratio, 2);
    ELSE
      v_ratio := v_fallback_ratio;
      v_returned_base := round(coalesce(v_comm.base_amount, 0) * v_ratio, 2);
    END IF;

    v_reverse := round(v_remaining * v_ratio, 2);
    -- Cumulative entitlement cap
    v_reverse := least(v_reverse, greatest(v_original - v_already_reversed, 0));
    IF v_reverse <= 0 THEN
      CONTINUE;
    END IF;

    -- Paid: track recoverable overpayment — do NOT fabricate cash/bank credit
    UPDATE public.salesman_commissions
    SET original_commission_amount = v_original,
        reversed_amount = coalesce(reversed_amount, 0) + v_reverse,
        commission_amount = greatest(commission_amount - v_reverse, 0),
        base_amount = greatest(base_amount - coalesce(v_returned_base, 0), 0),
        recoverable_amount = CASE
          WHEN v_comm.status = 'paid' THEN coalesce(recoverable_amount, 0) + v_reverse
          ELSE coalesce(recoverable_amount, 0)
        END,
        status = CASE
          WHEN commission_amount - v_reverse <= 0 THEN 'reversed'
          ELSE status
        END,
        event_type = CASE
          WHEN commission_amount - v_reverse <= 0 AND v_event IS NOT NULL THEN v_event
          ELSE event_type
        END,
        notes = trim(both FROM coalesce(notes, '') || ' '
          || v_marker_token || ':' || v_reverse::text || ':' || v_comm.status
          || CASE WHEN v_comm.status = 'paid' THEN ':recoverable' ELSE '' END),
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

COMMENT ON FUNCTION public._apply_contributor_commission_reversals(uuid, uuid, text, text, jsonb, numeric, uuid) IS
  'Commission clawback: sale_item_id-first matching (118) + V4 fixed-skip/recoverable/cap (133/151).';
