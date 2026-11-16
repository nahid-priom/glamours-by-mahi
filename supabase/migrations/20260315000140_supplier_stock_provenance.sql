-- Supplier Stock 360 — receipt-source provenance (additive)
-- Maps Receipt Source → purchase_items. Keeps WAC / inventory_balances SSOT.
-- Hooks via AFTER INSERT on stock_ledger (same transaction as _adjust_inventory).

--------------------------------------------------------------------------------
-- 1. Tables
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_receipt_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  supplier_id uuid REFERENCES public.suppliers (id),
  purchase_id uuid REFERENCES public.purchases (id),
  purchase_item_id uuid REFERENCES public.purchase_items (id),
  product_id uuid REFERENCES public.products (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  original_branch_id uuid REFERENCES public.branches (id),
  original_location_id uuid REFERENCES public.stock_locations (id),
  received_quantity numeric(14, 3) NOT NULL DEFAULT 0,
  receipt_unit_cost numeric(14, 2) NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  source_type text NOT NULL DEFAULT 'purchase'
    CHECK (source_type IN ('purchase', 'cutover', 'adjustment', 'opening')),
  traceability_status text NOT NULL DEFAULT 'system_allocated'
    CHECK (traceability_status IN ('verified', 'system_allocated', 'unknown_legacy')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid,
  CONSTRAINT inventory_receipt_sources_qty_check CHECK (received_quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_receipt_sources_purchase_item_uidx
  ON public.inventory_receipt_sources (organization_id, purchase_item_id)
  WHERE purchase_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_receipt_sources_org_supplier_idx
  ON public.inventory_receipt_sources (organization_id, supplier_id);

CREATE INDEX IF NOT EXISTS inventory_receipt_sources_org_variant_idx
  ON public.inventory_receipt_sources (organization_id, variant_id);

CREATE INDEX IF NOT EXISTS inventory_receipt_sources_received_at_idx
  ON public.inventory_receipt_sources (organization_id, received_at);

CREATE TABLE IF NOT EXISTS public.inventory_source_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  receipt_source_id uuid NOT NULL REFERENCES public.inventory_receipt_sources (id),
  stock_ledger_id uuid REFERENCES public.stock_ledger (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  event_type text NOT NULL
    CHECK (event_type IN (
      'receive', 'sale', 'sale_return', 'purchase_return',
      'transfer_out', 'transfer_in', 'damage', 'quarantine',
      'adjustment', 'correction', 'opening'
    )),
  quantity_delta numeric(14, 3) NOT NULL,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_source_allocations_idem_uidx
  ON public.inventory_source_allocations (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_source_allocations_source_idx
  ON public.inventory_source_allocations (organization_id, receipt_source_id);

CREATE INDEX IF NOT EXISTS inventory_source_allocations_ledger_idx
  ON public.inventory_source_allocations (stock_ledger_id)
  WHERE stock_ledger_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_source_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  receipt_source_id uuid NOT NULL REFERENCES public.inventory_receipt_sources (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  quantity numeric(14, 3) NOT NULL DEFAULT 0,
  qty_reserved numeric(14, 3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT inventory_source_positions_qty_check CHECK (quantity >= 0 AND qty_reserved >= 0),
  CONSTRAINT inventory_source_positions_natural_uidx
    UNIQUE (organization_id, receipt_source_id, variant_id, location_id)
);

CREATE INDEX IF NOT EXISTS inventory_source_positions_lookup_idx
  ON public.inventory_source_positions (organization_id, variant_id, branch_id, location_id);

ALTER TABLE public.inventory_receipt_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_source_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_source_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_receipt_sources_select ON public.inventory_receipt_sources;
CREATE POLICY inventory_receipt_sources_select ON public.inventory_receipt_sources
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
  );

DROP POLICY IF EXISTS inventory_source_allocations_select ON public.inventory_source_allocations;
CREATE POLICY inventory_source_allocations_select ON public.inventory_source_allocations
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
    AND public.user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS inventory_source_positions_select ON public.inventory_source_positions;
CREATE POLICY inventory_source_positions_select ON public.inventory_source_positions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
    AND public.user_has_branch_access(branch_id)
  );

--------------------------------------------------------------------------------
-- 2. Helpers
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._inventory_source_apply_delta(
  p_org_id uuid,
  p_receipt_source_id uuid,
  p_variant_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_qty_delta numeric,
  p_event_type text,
  p_stock_ledger_id uuid,
  p_actor uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pos public.inventory_source_positions%ROWTYPE;
  v_after numeric(14, 3);
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.inventory_source_allocations a
      WHERE a.organization_id = p_org_id AND a.idempotency_key = p_idempotency_key
    ) THEN
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_pos
  FROM public.inventory_source_positions
  WHERE organization_id = p_org_id
    AND receipt_source_id = p_receipt_source_id
    AND variant_id = p_variant_id
    AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.inventory_source_positions (
      organization_id, receipt_source_id, variant_id, branch_id, location_id, quantity
    ) VALUES (
      p_org_id, p_receipt_source_id, p_variant_id, p_branch_id, p_location_id, 0
    )
    RETURNING * INTO v_pos;
  END IF;

  v_after := v_pos.quantity + p_qty_delta;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Supplier source underflow: source=% variant=% need=% have=%',
      p_receipt_source_id, p_variant_id, abs(p_qty_delta), v_pos.quantity;
  END IF;

  UPDATE public.inventory_source_positions
  SET quantity = v_after,
      updated_at = timezone('utc', now())
  WHERE id = v_pos.id;

  INSERT INTO public.inventory_source_allocations (
    organization_id, receipt_source_id, stock_ledger_id, variant_id, branch_id, location_id,
    event_type, quantity_delta, actor_id, idempotency_key
  ) VALUES (
    p_org_id, p_receipt_source_id, p_stock_ledger_id, p_variant_id, p_branch_id, p_location_id,
    p_event_type, p_qty_delta, p_actor, p_idempotency_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._inventory_source_ensure_unknown(
  p_org_id uuid,
  p_variant_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source_id uuid;
  v_product_id uuid;
  v_bal numeric(14, 3);
  v_pos numeric(14, 3);
  v_gap numeric(14, 3);
BEGIN
  SELECT product_id INTO v_product_id
  FROM public.product_variants WHERE id = p_variant_id;

  SELECT s.id INTO v_source_id
  FROM public.inventory_receipt_sources s
  WHERE s.organization_id = p_org_id
    AND s.variant_id = p_variant_id
    AND s.traceability_status = 'unknown_legacy'
    AND s.source_type = 'cutover'
    AND s.original_location_id IS NOT DISTINCT FROM p_location_id
  LIMIT 1;

  IF v_source_id IS NULL THEN
    INSERT INTO public.inventory_receipt_sources (
      organization_id, supplier_id, product_id, variant_id,
      original_branch_id, original_location_id,
      received_quantity, receipt_unit_cost, source_type, traceability_status, created_by
    ) VALUES (
      p_org_id, NULL, v_product_id, p_variant_id,
      p_branch_id, p_location_id,
      0, 0, 'cutover', 'unknown_legacy', p_actor
    )
    RETURNING id INTO v_source_id;
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_bal
  FROM public.inventory_balances
  WHERE organization_id = p_org_id
    AND variant_id = p_variant_id
    AND location_id = p_location_id
    AND deleted_at IS NULL;

  SELECT COALESCE(SUM(quantity), 0) INTO v_pos
  FROM public.inventory_source_positions
  WHERE organization_id = p_org_id
    AND variant_id = p_variant_id
    AND location_id = p_location_id;

  v_gap := COALESCE(v_bal, 0) - COALESCE(v_pos, 0);
  IF v_gap > 0 THEN
    UPDATE public.inventory_receipt_sources
    SET received_quantity = received_quantity + v_gap
    WHERE id = v_source_id;

    PERFORM public._inventory_source_apply_delta(
      p_org_id, v_source_id, p_variant_id, p_branch_id, p_location_id,
      v_gap, 'receive', NULL, p_actor,
      'unknown-fill:' || p_variant_id::text || ':' || p_location_id::text || ':' || v_gap::text || ':' || extract(epoch from clock_timestamp())::text
    );
  END IF;

  RETURN v_source_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._inventory_source_receive(
  p_org_id uuid,
  p_supplier_id uuid,
  p_purchase_id uuid,
  p_purchase_item_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_qty numeric,
  p_unit_cost numeric,
  p_received_at timestamptz,
  p_stock_ledger_id uuid,
  p_actor uuid,
  p_source_type text DEFAULT 'purchase',
  p_traceability text DEFAULT 'system_allocated',
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source_id uuid;
BEGIN
  IF p_purchase_item_id IS NOT NULL THEN
    SELECT id INTO v_source_id
    FROM public.inventory_receipt_sources
    WHERE organization_id = p_org_id AND purchase_item_id = p_purchase_item_id;
  END IF;

  IF v_source_id IS NULL THEN
    INSERT INTO public.inventory_receipt_sources (
      organization_id, supplier_id, purchase_id, purchase_item_id,
      product_id, variant_id, original_branch_id, original_location_id,
      received_quantity, receipt_unit_cost, received_at,
      source_type, traceability_status, created_by
    ) VALUES (
      p_org_id, p_supplier_id, p_purchase_id, p_purchase_item_id,
      p_product_id, p_variant_id, p_branch_id, p_location_id,
      p_qty, COALESCE(p_unit_cost, 0), COALESCE(p_received_at, timezone('utc', now())),
      p_source_type, p_traceability, p_actor
    )
    RETURNING id INTO v_source_id;
  END IF;

  PERFORM public._inventory_source_apply_delta(
    p_org_id, v_source_id, p_variant_id, p_branch_id, p_location_id,
    p_qty, 'receive', p_stock_ledger_id, p_actor, p_idempotency_key
  );
  RETURN v_source_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._inventory_source_consume_fifo(
  p_org_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_qty numeric,
  p_event_type text,
  p_stock_ledger_id uuid,
  p_actor uuid,
  p_idempotency_prefix text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_need numeric(14, 3) := abs(p_qty);
  v_take numeric(14, 3);
  r RECORD;
  v_i int := 0;
BEGIN
  IF v_need <= 0 THEN RETURN; END IF;

  PERFORM public._inventory_source_ensure_unknown(
    p_org_id, p_variant_id, p_branch_id, p_location_id, p_actor
  );

  FOR r IN
    SELECT sp.id AS position_id, sp.receipt_source_id, sp.quantity, s.received_at
    FROM public.inventory_source_positions sp
    JOIN public.inventory_receipt_sources s ON s.id = sp.receipt_source_id
    WHERE sp.organization_id = p_org_id
      AND sp.variant_id = p_variant_id
      AND sp.location_id = p_location_id
      AND sp.quantity > 0
    ORDER BY
      CASE WHEN s.traceability_status = 'unknown_legacy' THEN 1 ELSE 0 END,
      s.received_at ASC,
      s.id ASC
    FOR UPDATE OF sp
  LOOP
    EXIT WHEN v_need <= 0;
    v_take := LEAST(r.quantity, v_need);
    v_i := v_i + 1;
    PERFORM public._inventory_source_apply_delta(
      p_org_id, r.receipt_source_id, p_variant_id, p_branch_id, p_location_id,
      -v_take, p_event_type, p_stock_ledger_id, p_actor,
      CASE WHEN p_idempotency_prefix IS NULL THEN NULL
           ELSE p_idempotency_prefix || ':' || v_i::text || ':' || r.receipt_source_id::text END
    );
    v_need := v_need - v_take;
  END LOOP;

  IF v_need > 0.0005 THEN
    RAISE EXCEPTION 'Insufficient supplier-attributed stock for variant % (short %)',
      p_variant_id, v_need;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._inventory_source_move_fifo(
  p_org_id uuid,
  p_from_branch uuid,
  p_from_location uuid,
  p_to_branch uuid,
  p_to_location uuid,
  p_variant_id uuid,
  p_qty numeric,
  p_stock_ledger_id uuid,
  p_actor uuid,
  p_idempotency_prefix text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_need numeric(14, 3) := abs(p_qty);
  v_take numeric(14, 3);
  r RECORD;
  v_i int := 0;
BEGIN
  IF v_need <= 0 THEN RETURN; END IF;
  PERFORM public._inventory_source_ensure_unknown(
    p_org_id, p_variant_id, p_from_branch, p_from_location, p_actor
  );

  FOR r IN
    SELECT sp.receipt_source_id, sp.quantity, s.received_at
    FROM public.inventory_source_positions sp
    JOIN public.inventory_receipt_sources s ON s.id = sp.receipt_source_id
    WHERE sp.organization_id = p_org_id
      AND sp.variant_id = p_variant_id
      AND sp.location_id = p_from_location
      AND sp.quantity > 0
    ORDER BY
      CASE WHEN s.traceability_status = 'unknown_legacy' THEN 1 ELSE 0 END,
      s.received_at ASC, s.id ASC
    FOR UPDATE OF sp
  LOOP
    EXIT WHEN v_need <= 0;
    v_take := LEAST(r.quantity, v_need);
    v_i := v_i + 1;
    PERFORM public._inventory_source_apply_delta(
      p_org_id, r.receipt_source_id, p_variant_id, p_from_branch, p_from_location,
      -v_take, 'transfer_out', p_stock_ledger_id, p_actor,
      p_idempotency_prefix || ':out:' || v_i::text || ':' || r.receipt_source_id::text
    );
    PERFORM public._inventory_source_apply_delta(
      p_org_id, r.receipt_source_id, p_variant_id, p_to_branch, p_to_location,
      v_take, 'transfer_in', p_stock_ledger_id, p_actor,
      p_idempotency_prefix || ':in:' || v_i::text || ':' || r.receipt_source_id::text
    );
    v_need := v_need - v_take;
  END LOOP;

  IF v_need > 0.0005 THEN
    RAISE EXCEPTION 'Insufficient source stock to transfer variant % (short %)', p_variant_id, v_need;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._inventory_source_apply_delta FROM PUBLIC;
REVOKE ALL ON FUNCTION public._inventory_source_ensure_unknown FROM PUBLIC;
REVOKE ALL ON FUNCTION public._inventory_source_receive FROM PUBLIC;
REVOKE ALL ON FUNCTION public._inventory_source_consume_fifo FROM PUBLIC;
REVOKE ALL ON FUNCTION public._inventory_source_move_fifo FROM PUBLIC;

--------------------------------------------------------------------------------
-- 3. Ledger trigger — atomic provenance with _adjust_inventory
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._inventory_source_on_ledger_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_branch uuid;
  v_supplier uuid;
  v_pi_id uuid;
  v_product_id uuid;
  v_unit_cost numeric(14, 2);
  v_key text;
  v_src uuid;
  v_rem numeric(14, 3);
  v_take numeric(14, 3);
  a RECORD;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.location_id IS NULL OR NEW.variant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT branch_id INTO v_branch FROM public.stock_locations WHERE id = NEW.location_id;
  IF v_branch IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_type = 'purchase'
     AND NEW.reference_type = 'purchase'
     AND NEW.quantity_delta > 0 THEN
    SELECT p.supplier_id INTO v_supplier
    FROM public.purchases p WHERE p.id = NEW.reference_id;

    SELECT pi.id, pv.product_id, pi.unit_cost
      INTO v_pi_id, v_product_id, v_unit_cost
    FROM public.purchase_items pi
    JOIN public.product_variants pv ON pv.id = pi.variant_id
    WHERE pi.purchase_id = NEW.reference_id
      AND pi.variant_id = NEW.variant_id
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_receipt_sources s
        WHERE s.purchase_item_id = pi.id
      )
    ORDER BY pi.created_at ASC
    LIMIT 1;

    IF v_pi_id IS NOT NULL THEN
      v_key := 'recv:pi:' || v_pi_id::text || ':led:' || NEW.id::text;
      PERFORM public._inventory_source_receive(
        NEW.organization_id, v_supplier, NEW.reference_id, v_pi_id,
        v_product_id, NEW.variant_id, v_branch, NEW.location_id,
        NEW.quantity_delta, COALESCE(NEW.unit_cost, v_unit_cost, 0),
        NEW.occurred_at, NEW.id, NEW.created_by,
        'purchase', 'system_allocated', v_key
      );
    ELSE
      PERFORM public._inventory_source_ensure_unknown(
        NEW.organization_id, NEW.variant_id, v_branch, NEW.location_id, NEW.created_by
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.movement_type = 'opening' AND NEW.quantity_delta > 0 THEN
    SELECT product_id INTO v_product_id FROM public.product_variants WHERE id = NEW.variant_id;
    v_key := 'recv:open:led:' || NEW.id::text;
    PERFORM public._inventory_source_receive(
      NEW.organization_id, NULL, NULL, NULL,
      v_product_id, NEW.variant_id, v_branch, NEW.location_id,
      NEW.quantity_delta, COALESCE(NEW.unit_cost, 0),
      NEW.occurred_at, NEW.id, NEW.created_by,
      'opening', 'unknown_legacy', v_key
    );
    RETURN NEW;
  END IF;

  IF NEW.quantity_delta < 0 AND NEW.movement_type IN (
    'sale', 'purchase_return', 'adjustment', 'damage', 'quarantine', 'correction', 'transfer_out'
  ) THEN
    PERFORM public._inventory_source_consume_fifo(
      NEW.organization_id, v_branch, NEW.variant_id, NEW.location_id,
      NEW.quantity_delta,
      CASE NEW.movement_type
        WHEN 'sale' THEN 'sale'
        WHEN 'purchase_return' THEN 'purchase_return'
        WHEN 'damage' THEN 'damage'
        WHEN 'quarantine' THEN 'quarantine'
        WHEN 'transfer_out' THEN 'transfer_out'
        WHEN 'correction' THEN 'correction'
        ELSE 'adjustment'
      END,
      NEW.id, NEW.created_by, 'led:' || NEW.id::text
    );
    RETURN NEW;
  END IF;

  IF NEW.quantity_delta > 0 AND NEW.movement_type IN ('sale_return', 'correction', 'adjustment') THEN
    v_src := public._inventory_source_ensure_unknown(
      NEW.organization_id, NEW.variant_id, v_branch, NEW.location_id, NEW.created_by
    );
    PERFORM public._inventory_source_apply_delta(
      NEW.organization_id, v_src, NEW.variant_id, v_branch, NEW.location_id,
      NEW.quantity_delta,
      CASE NEW.movement_type WHEN 'sale_return' THEN 'sale_return' ELSE 'correction' END,
      NEW.id, NEW.created_by, 'led-in:' || NEW.id::text
    );
    RETURN NEW;
  END IF;

  IF NEW.movement_type = 'transfer_in' AND NEW.quantity_delta > 0 THEN
    v_rem := NEW.quantity_delta;
    FOR a IN
      SELECT sa.id AS alloc_id, sa.receipt_source_id, abs(sa.quantity_delta) AS qty
      FROM public.inventory_source_allocations sa
      JOIN public.stock_ledger sl ON sl.id = sa.stock_ledger_id
      WHERE sa.organization_id = NEW.organization_id
        AND sa.event_type = 'transfer_out'
        AND sa.variant_id = NEW.variant_id
        AND sl.reference_type = COALESCE(NEW.reference_type, '')
        AND sl.reference_id IS NOT DISTINCT FROM NEW.reference_id
        AND NOT EXISTS (
          SELECT 1 FROM public.inventory_source_allocations x
          WHERE x.organization_id = NEW.organization_id
            AND x.idempotency_key LIKE 'xfer-in-match:' || NEW.id::text || ':' || sa.id::text || '%'
        )
      ORDER BY sa.occurred_at ASC, sa.id ASC
    LOOP
      EXIT WHEN v_rem <= 0;
      v_take := LEAST(a.qty, v_rem);
      PERFORM public._inventory_source_apply_delta(
        NEW.organization_id, a.receipt_source_id, NEW.variant_id, v_branch, NEW.location_id,
        v_take, 'transfer_in', NEW.id, NEW.created_by,
        'xfer-in-match:' || NEW.id::text || ':' || a.alloc_id::text
      );
      v_rem := v_rem - v_take;
    END LOOP;

    IF v_rem > 0.0005 THEN
      v_src := public._inventory_source_ensure_unknown(
        NEW.organization_id, NEW.variant_id, v_branch, NEW.location_id, NEW.created_by
      );
      PERFORM public._inventory_source_apply_delta(
        NEW.organization_id, v_src, NEW.variant_id, v_branch, NEW.location_id,
        v_rem, 'transfer_in', NEW.id, NEW.created_by, 'xfer-in-unk:' || NEW.id::text
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_source_on_ledger_insert ON public.stock_ledger;
CREATE TRIGGER inventory_source_on_ledger_insert
  AFTER INSERT ON public.stock_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public._inventory_source_on_ledger_insert();

--------------------------------------------------------------------------------
-- 4. Backfill
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_inventory_receipt_sources()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sources int := 0;
  v_unknown int := 0;
  r RECORD;
  v_src uuid;
  v_gap numeric(14, 3);
  v_pos numeric(14, 3);
BEGIN
  -- Historical purchase lines → receipt sources (received fact only; no remaining assignment)
  FOR r IN
    SELECT
      pi.id AS purchase_item_id,
      pi.purchase_id,
      pi.variant_id,
      pi.qty,
      pi.unit_cost,
      pi.created_at,
      p.organization_id,
      p.supplier_id,
      p.branch_id,
      pv.product_id,
      (
        SELECT sl.id FROM public.stock_locations sl
        WHERE sl.branch_id = p.branch_id
          AND sl.location_type = 'saleable'
          AND sl.deleted_at IS NULL
          AND sl.is_active = true
        ORDER BY sl.created_at ASC
        LIMIT 1
      ) AS location_id
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id AND p.deleted_at IS NULL
    JOIN public.product_variants pv ON pv.id = pi.variant_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_receipt_sources s WHERE s.purchase_item_id = pi.id
    )
  LOOP
    INSERT INTO public.inventory_receipt_sources (
      organization_id, supplier_id, purchase_id, purchase_item_id,
      product_id, variant_id, original_branch_id, original_location_id,
      received_quantity, receipt_unit_cost, received_at,
      source_type, traceability_status
    ) VALUES (
      r.organization_id, r.supplier_id, r.purchase_id, r.purchase_item_id,
      r.product_id, r.variant_id, r.branch_id, r.location_id,
      COALESCE(r.qty, 0), COALESCE(r.unit_cost, 0), COALESCE(r.created_at, timezone('utc', now())),
      'purchase', 'system_allocated'
    );
    v_sources := v_sources + 1;
  END LOOP;

  -- Residual on-hand → UNKNOWN_LEGACY positions (honest cutover)
  FOR r IN
    SELECT ib.organization_id, ib.variant_id, ib.location_id, ib.quantity,
           sl.branch_id, pv.product_id
    FROM public.inventory_balances ib
    JOIN public.stock_locations sl ON sl.id = ib.location_id
    JOIN public.product_variants pv ON pv.id = ib.variant_id
    WHERE ib.deleted_at IS NULL AND ib.quantity > 0
  LOOP
    SELECT COALESCE(SUM(sp.quantity), 0) INTO v_pos
    FROM public.inventory_source_positions sp
    WHERE sp.organization_id = r.organization_id
      AND sp.variant_id = r.variant_id
      AND sp.location_id = r.location_id;

    v_gap := r.quantity - COALESCE(v_pos, 0);
    IF v_gap > 0 THEN
      v_src := public._inventory_source_ensure_unknown(
        r.organization_id, r.variant_id, r.branch_id, r.location_id, NULL
      );
      -- ensure_unknown already fills gap
      v_unknown := v_unknown + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'purchase_sources_created', v_sources,
    'unknown_balance_locations', v_unknown
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_inventory_receipt_sources() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_inventory_receipt_sources() TO authenticated, service_role;

SELECT public.backfill_inventory_receipt_sources();

CREATE OR REPLACE FUNCTION public._inventory_source_reconcile_check(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  variant_id uuid,
  location_id uuid,
  balance_qty numeric,
  attributed_qty numeric,
  delta numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH org AS (
    SELECT COALESCE(p_org_id, public.current_organization_id()) AS id
  )
  SELECT
    ib.variant_id,
    ib.location_id,
    ib.quantity AS balance_qty,
    COALESCE(SUM(sp.quantity), 0) AS attributed_qty,
    ib.quantity - COALESCE(SUM(sp.quantity), 0) AS delta
  FROM public.inventory_balances ib
  CROSS JOIN org
  LEFT JOIN public.inventory_source_positions sp
    ON sp.organization_id = ib.organization_id
   AND sp.variant_id = ib.variant_id
   AND sp.location_id = ib.location_id
  WHERE ib.organization_id = org.id
    AND ib.deleted_at IS NULL
  GROUP BY ib.variant_id, ib.location_id, ib.quantity
  HAVING abs(ib.quantity - COALESCE(SUM(sp.quantity), 0)) > 0.0005;
$$;

GRANT EXECUTE ON FUNCTION public._inventory_source_reconcile_check(uuid) TO authenticated, service_role;
