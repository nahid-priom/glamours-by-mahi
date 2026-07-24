-- Production inventory ledger backfill (scoped, idempotent)

CREATE OR REPLACE FUNCTION public.apply_organization_reconciliation_backfill(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_opening int := 0;
  v_residual int := 0;
  v_qty_total numeric(14, 3) := 0;
  r record;
  v_batch_id uuid := gen_random_uuid();
  v_before int;
  v_after int;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND coalesce(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role or migration only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.deleted_at IS NULL AND coalesce(o.is_sandbox, false) = false
  ) THEN
    RAISE EXCEPTION 'Organization % is not a production org', p_org_id;
  END IF;

  SELECT p.id INTO v_actor
  FROM public.profiles p
  WHERE p.organization_id = p_org_id
    AND p.is_active
    AND p.deleted_at IS NULL
  ORDER BY p.created_at
  LIMIT 1;

  SELECT count(*) INTO v_before
  FROM public.v_recon_inventory_ledger_qty v
  WHERE v.organization_id = p_org_id;

  FOR r IN
    SELECT v.*
    FROM public.v_recon_inventory_without_ledger v
    WHERE v.organization_id = p_org_id
    ORDER BY v.variant_id, v.location_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.stock_ledger sl
      WHERE sl.organization_id = p_org_id
        AND sl.variant_id = r.variant_id
        AND sl.location_id = r.location_id
        AND sl.movement_type = 'opening'
        AND sl.reference_type = 'reconciliation'
        AND sl.reference_id = v_batch_id
        AND sl.deleted_at IS NULL
    ) THEN
      INSERT INTO public.stock_ledger (
        organization_id, branch_id, variant_id, location_id,
        quantity_delta, quantity_before, quantity_after, unit_cost,
        movement_type, reference_type, reference_id, notes,
        created_by, updated_by
      ) VALUES (
        p_org_id, r.branch_id, r.variant_id, r.location_id,
        r.quantity, 0, r.quantity, NULL,
        'opening', 'reconciliation', v_batch_id,
        'Production opening stock ledger backfill (quantity unchanged)',
        v_actor, v_actor
      );
      v_opening := v_opening + 1;
      v_qty_total := v_qty_total + r.quantity;
    END IF;
  END LOOP;

  FOR r IN
    SELECT
      v.organization_id,
      v.variant_id,
      v.location_id,
      v.balance_qty,
      v.ledger_net_qty,
      v.delta,
      sl.branch_id
    FROM public.v_recon_inventory_ledger_qty v
    JOIN public.stock_locations sl ON sl.id = v.location_id AND sl.deleted_at IS NULL
    WHERE v.organization_id = p_org_id
    ORDER BY v.variant_id, v.location_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.stock_ledger sl2
      WHERE sl2.organization_id = p_org_id
        AND sl2.variant_id = r.variant_id
        AND sl2.location_id = r.location_id
        AND sl2.movement_type = 'adjustment'
        AND sl2.reference_type = 'reconciliation'
        AND sl2.reference_id = v_batch_id
        AND sl2.deleted_at IS NULL
    ) THEN
      INSERT INTO public.stock_ledger (
        organization_id, branch_id, variant_id, location_id,
        quantity_delta, quantity_before, quantity_after, unit_cost,
        movement_type, reference_type, reference_id, notes,
        created_by, updated_by
      ) VALUES (
        p_org_id, r.branch_id, r.variant_id, r.location_id,
        r.delta, r.ledger_net_qty, r.balance_qty, NULL,
        'adjustment', 'reconciliation', v_batch_id,
        'Production ledger qty reconciliation (balance unchanged)',
        v_actor, v_actor
      );
      v_residual := v_residual + 1;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_after
  FROM public.v_recon_inventory_ledger_qty v
  WHERE v.organization_id = p_org_id;

  RETURN jsonb_build_object(
    'organization_id', p_org_id,
    'batch_id', v_batch_id,
    'opening_ledger_rows', v_opening,
    'residual_adjustment_rows', v_residual,
    'qty_total_opening', v_qty_total,
    'inventory_mismatches_before', v_before,
    'inventory_mismatches_after', v_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_organization_reconciliation_backfill(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_organization_reconciliation_backfill(uuid) TO service_role;

SELECT public.apply_organization_reconciliation_backfill('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid);
