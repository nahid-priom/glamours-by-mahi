-- Supplier 360 Phase 2/4/5 schema:
-- - Nullable profile columns on suppliers
-- - supplier_documents + private storage bucket
-- - Directory summary + card RPCs
-- - Stock velocity RPC
-- - Sale-return reverse allocation (prefer prior sale lots)

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS vat_reg_no text,
  ADD COLUMN IF NOT EXISTS payment_terms_days int,
  ADD COLUMN IF NOT EXISTS credit_limit numeric(14, 2),
  ADD COLUMN IF NOT EXISTS established_year int;

COMMENT ON COLUMN public.suppliers.code IS 'Optional supplier business code';
COMMENT ON COLUMN public.suppliers.payment_terms_days IS 'Net payment terms in days';
COMMENT ON COLUMN public.suppliers.credit_limit IS 'Credit limit in organization currency';

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id),
  title text,
  doc_type text DEFAULT 'other',
  file_name text NOT NULL,
  file_path text NOT NULL,
  storage_path text,
  mime_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS supplier_documents_supplier_idx
  ON public.supplier_documents (supplier_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS supplier_documents_org_idx
  ON public.supplier_documents (organization_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_documents_select ON public.supplier_documents;
CREATE POLICY supplier_documents_select ON public.supplier_documents
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('suppliers.read')
      OR public.user_has_permission('suppliers.manage')
      OR public.user_has_permission('accounts.read')
    )
  );

DROP POLICY IF EXISTS supplier_documents_insert ON public.supplier_documents;
CREATE POLICY supplier_documents_insert ON public.supplier_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  );

DROP POLICY IF EXISTS supplier_documents_update ON public.supplier_documents;
CREATE POLICY supplier_documents_update ON public.supplier_documents
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS supplier_documents_storage_select ON storage.objects;
CREATE POLICY supplier_documents_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

DROP POLICY IF EXISTS supplier_documents_storage_insert ON storage.objects;
CREATE POLICY supplier_documents_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
    AND public.user_has_permission('suppliers.manage')
  );

DROP POLICY IF EXISTS supplier_documents_storage_delete ON storage.objects;
CREATE POLICY supplier_documents_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
    AND public.user_has_permission('suppliers.manage')
  );

-- ---------------------------------------------------------------------------
-- Directory summary + cards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_supplier_directory_summary(
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_total_suppliers int := 0;
  v_total_purchases numeric(14,2) := 0;
  v_total_payments numeric(14,2) := 0;
  v_current_due numeric(14,2) := 0;
  v_stock numeric(14,3) := 0;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organization context required'; END IF;
  IF NOT public.user_has_permission('suppliers.read') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::int,
         coalesce(sum(s.current_due), 0)
  INTO v_total_suppliers, v_current_due
  FROM public.suppliers s
  WHERE s.organization_id = v_org
    AND s.deleted_at IS NULL
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT coalesce(sum(sl.debit), 0)
  INTO v_total_purchases
  FROM public.supplier_ledger sl
  WHERE sl.organization_id = v_org
    AND sl.deleted_at IS NULL
    AND sl.entry_type IN ('purchase_invoice', 'purchase_due')
    AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id);

  SELECT coalesce(sum(sl.credit), 0)
  INTO v_total_payments
  FROM public.supplier_ledger sl
  WHERE sl.organization_id = v_org
    AND sl.deleted_at IS NULL
    AND sl.entry_type IN ('supplier_payment', 'purchase_payment', 'payment')
    AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id);

  SELECT coalesce(sum(sp.quantity), 0)
  INTO v_stock
  FROM public.inventory_source_positions sp
  JOIN public.inventory_receipt_sources irs ON irs.id = sp.receipt_source_id
  JOIN public.stock_locations loc ON loc.id = sp.location_id AND loc.deleted_at IS NULL
  WHERE sp.organization_id = v_org
    AND irs.supplier_id IS NOT NULL
    AND public.user_has_branch_access(loc.branch_id)
    AND (p_branch_id IS NULL OR loc.branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'total_suppliers', v_total_suppliers,
    'total_purchases', v_total_purchases,
    'total_payments', v_total_payments,
    'current_due', v_current_due,
    'total_items_in_stock', v_stock,
    'stock_unit_label', 'pcs',
    'scope', CASE WHEN p_branch_id IS NULL THEN 'organization' ELSE 'branch' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_supplier_directory_cards(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_due_only boolean DEFAULT false,
  p_due_min numeric DEFAULT NULL,
  p_due_max numeric DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_sort_by text DEFAULT 'name',
  p_sort_dir text DEFAULT 'asc',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_page int := GREATEST(coalesce(p_page, 1), 1);
  v_size int := LEAST(GREATEST(coalesce(p_page_size, 30), 1), 100);
  v_search text := NULLIF(trim(p_search), '');
  v_sort text := lower(coalesce(p_sort_by, 'name'));
  v_dir text := lower(coalesce(p_sort_dir, 'asc'));
  v_total int := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organization context required'; END IF;
  IF NOT public.user_has_permission('suppliers.read') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT
      s.*,
      coalesce((
        SELECT sum(sl.credit)
        FROM public.supplier_ledger sl
        WHERE sl.supplier_id = s.id
          AND sl.deleted_at IS NULL
          AND sl.entry_type IN ('supplier_payment', 'purchase_payment', 'payment')
      ), 0) AS total_paid,
      coalesce((
        SELECT sum(sl.debit)
        FROM public.supplier_ledger sl
        WHERE sl.supplier_id = s.id
          AND sl.deleted_at IS NULL
          AND sl.entry_type IN ('purchase_invoice', 'purchase_due')
      ), 0) AS total_purchased,
      (
        SELECT sum(sp.quantity)
        FROM public.inventory_source_positions sp
        JOIN public.inventory_receipt_sources irs ON irs.id = sp.receipt_source_id
        JOIN public.stock_locations loc ON loc.id = sp.location_id AND loc.deleted_at IS NULL
        WHERE sp.organization_id = v_org
          AND irs.supplier_id = s.id
          AND public.user_has_branch_access(loc.branch_id)
          AND (p_branch_id IS NULL OR loc.branch_id = p_branch_id)
      ) AS stock_on_hand,
      (
        SELECT sum(abs(a.quantity_delta))
        FROM public.inventory_source_allocations a
        JOIN public.inventory_receipt_sources irs ON irs.id = a.receipt_source_id
        WHERE a.organization_id = v_org
          AND irs.supplier_id = s.id
          AND a.event_type = 'sale'
          AND a.quantity_delta < 0
      ) AS units_sold,
      (
        SELECT max(sl.occurred_at)
        FROM public.supplier_ledger sl
        WHERE sl.supplier_id = s.id AND sl.deleted_at IS NULL
      ) AS last_activity_at
    FROM public.suppliers s
    WHERE s.organization_id = v_org
      AND s.deleted_at IS NULL
      AND (p_status IS NULL OR s.status = p_status)
      AND (NOT coalesce(p_due_only, false) OR s.current_due > 0)
      AND (p_due_min IS NULL OR s.current_due >= p_due_min)
      AND (p_due_max IS NULL OR s.current_due <= p_due_max)
      AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (
        v_search IS NULL
        OR s.name ILIKE '%' || v_search || '%'
        OR coalesce(s.phone, '') ILIKE '%' || v_search || '%'
        OR coalesce(s.email, '') ILIKE '%' || v_search || '%'
        OR coalesce(s.code, '') ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT count(*)::int AS total_count FROM base
  ),
  sorted AS (
    SELECT b.*
    FROM base b
    ORDER BY
      CASE WHEN v_sort = 'due' AND v_dir = 'asc' THEN b.current_due END ASC NULLS LAST,
      CASE WHEN v_sort = 'due' AND v_dir = 'desc' THEN b.current_due END DESC NULLS LAST,
      CASE WHEN v_sort = 'purchases' AND v_dir = 'asc' THEN b.total_purchased END ASC NULLS LAST,
      CASE WHEN v_sort = 'purchases' AND v_dir = 'desc' THEN b.total_purchased END DESC NULLS LAST,
      CASE WHEN v_sort = 'paid' AND v_dir = 'asc' THEN b.total_paid END ASC NULLS LAST,
      CASE WHEN v_sort = 'paid' AND v_dir = 'desc' THEN b.total_paid END DESC NULLS LAST,
      CASE WHEN v_sort = 'stock' AND v_dir = 'asc' THEN b.stock_on_hand END ASC NULLS LAST,
      CASE WHEN v_sort = 'stock' AND v_dir = 'desc' THEN b.stock_on_hand END DESC NULLS LAST,
      CASE WHEN v_sort = 'activity' AND v_dir = 'asc' THEN b.last_activity_at END ASC NULLS LAST,
      CASE WHEN v_sort = 'activity' AND v_dir = 'desc' THEN b.last_activity_at END DESC NULLS LAST,
      CASE WHEN v_dir = 'desc' THEN b.name END DESC,
      b.name ASC
    OFFSET (v_page - 1) * v_size
    LIMIT v_size
  )
  SELECT
    c.total_count,
    coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.name), '[]'::jsonb)
  INTO v_total, v_items
  FROM counted c
  LEFT JOIN sorted s ON true
  GROUP BY c.total_count;

  RETURN jsonb_build_object(
    'total_count', coalesce(v_total, 0),
    'page', v_page,
    'page_size', v_size,
    'items', coalesce(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_directory_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_directory_cards(text, text, boolean, numeric, numeric, uuid, text, text, int, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- Velocity (configurable thresholds via org settings.simple_accounting)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_supplier_stock_velocity(
  p_supplier_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_days int := LEAST(GREATEST(coalesce(p_days, 30), 1), 365);
  v_fast numeric := 2;
  v_slow numeric := 0.2;
  v_settings jsonb;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organization context required'; END IF;
  IF NOT (
    public.user_has_permission('inventory.read')
    OR public.user_has_permission('suppliers.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT settings->'simple_accounting' INTO v_settings
  FROM public.organizations WHERE id = v_org;

  v_fast := coalesce((v_settings->>'supplier_velocity_fast_per_day')::numeric, 2);
  v_slow := coalesce((v_settings->>'supplier_velocity_slow_per_day')::numeric, 0.2);

  RETURN (
    WITH sales AS (
      SELECT
        irs.variant_id,
        sum(abs(a.quantity_delta)) AS sold_qty
      FROM public.inventory_source_allocations a
      JOIN public.inventory_receipt_sources irs ON irs.id = a.receipt_source_id
      WHERE a.organization_id = v_org
        AND irs.supplier_id = p_supplier_id
        AND a.event_type = 'sale'
        AND a.quantity_delta < 0
        AND a.occurred_at >= timezone('utc', now()) - make_interval(days => v_days)
      GROUP BY irs.variant_id
    ),
    on_hand AS (
      SELECT
        irs.variant_id,
        sum(sp.quantity) AS qty
      FROM public.inventory_source_positions sp
      JOIN public.inventory_receipt_sources irs ON irs.id = sp.receipt_source_id
      JOIN public.stock_locations loc ON loc.id = sp.location_id AND loc.deleted_at IS NULL
      WHERE sp.organization_id = v_org
        AND irs.supplier_id = p_supplier_id
        AND public.user_has_branch_access(loc.branch_id)
        AND (p_branch_id IS NULL OR loc.branch_id = p_branch_id)
      GROUP BY irs.variant_id
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'variant_id', coalesce(o.variant_id, s.variant_id),
      'product_name', p.name,
      'sku', pv.sku,
      'on_hand', coalesce(o.qty, 0),
      'sold_qty', coalesce(s.sold_qty, 0),
      'avg_daily_sales', round(coalesce(s.sold_qty, 0) / v_days::numeric, 4),
      'days_of_cover', CASE
        WHEN coalesce(s.sold_qty, 0) <= 0 THEN NULL
        ELSE round(coalesce(o.qty, 0) / (s.sold_qty / v_days::numeric), 1)
      END,
      'movement_status', CASE
        WHEN coalesce(s.sold_qty, 0) / v_days::numeric >= v_fast THEN 'fast'
        WHEN coalesce(s.sold_qty, 0) <= 0 THEN 'dead'
        WHEN coalesce(s.sold_qty, 0) / v_days::numeric <= v_slow THEN 'slow'
        ELSE 'normal'
      END,
      'period_days', v_days
    )), '[]'::jsonb)
    FROM on_hand o
    FULL OUTER JOIN sales s ON s.variant_id = o.variant_id
    JOIN public.product_variants pv ON pv.id = coalesce(o.variant_id, s.variant_id)
    JOIN public.products p ON p.id = pv.product_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_stock_velocity(uuid, uuid, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- Sale return: reverse prior sale allocations when possible
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._inventory_source_restore_sale_return(
  p_org_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_qty numeric,
  p_stock_ledger_id uuid,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rem numeric(14, 3) := p_qty;
  v_take numeric(14, 3);
  r RECORD;
  v_src uuid;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT a.id, a.receipt_source_id, abs(a.quantity_delta) AS qty
    FROM public.inventory_source_allocations a
    JOIN public.inventory_receipt_sources irs ON irs.id = a.receipt_source_id
    WHERE a.organization_id = p_org_id
      AND a.variant_id = p_variant_id
      AND a.event_type = 'sale'
      AND a.quantity_delta < 0
      AND irs.traceability_status IS DISTINCT FROM 'unknown_legacy'
    ORDER BY a.occurred_at DESC, a.id DESC
  LOOP
    EXIT WHEN v_rem <= 0.0005;
    v_take := LEAST(v_rem, r.qty);
    IF v_take <= 0 THEN CONTINUE; END IF;

    PERFORM public._inventory_source_apply_delta(
      p_org_id, r.receipt_source_id, p_variant_id, p_branch_id, p_location_id,
      v_take, 'sale_return', p_stock_ledger_id, p_actor,
      'sale-ret-restore:' || p_stock_ledger_id::text || ':' || r.id::text
    );
    v_rem := v_rem - v_take;
  END LOOP;

  IF v_rem > 0.0005 THEN
    v_src := public._inventory_source_ensure_unknown(
      p_org_id, p_variant_id, p_branch_id, p_location_id, p_actor
    );
    PERFORM public._inventory_source_apply_delta(
      p_org_id, v_src, p_variant_id, p_branch_id, p_location_id,
      v_rem, 'sale_return', p_stock_ledger_id, p_actor,
      'sale-ret-unk:' || p_stock_ledger_id::text
    );
  END IF;
END;
$$;

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

  -- Sale returns: restore prior sale lots when possible; residue → unknown_legacy
  IF NEW.quantity_delta > 0 AND NEW.movement_type = 'sale_return' THEN
    PERFORM public._inventory_source_restore_sale_return(
      NEW.organization_id, v_branch, NEW.variant_id, NEW.location_id,
      NEW.quantity_delta, NEW.id, NEW.created_by
    );
    RETURN NEW;
  END IF;

  IF NEW.quantity_delta > 0 AND NEW.movement_type IN ('correction', 'adjustment') THEN
    v_src := public._inventory_source_ensure_unknown(
      NEW.organization_id, NEW.variant_id, v_branch, NEW.location_id, NEW.created_by
    );
    PERFORM public._inventory_source_apply_delta(
      NEW.organization_id, v_src, NEW.variant_id, v_branch, NEW.location_id,
      NEW.quantity_delta, 'correction',
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
