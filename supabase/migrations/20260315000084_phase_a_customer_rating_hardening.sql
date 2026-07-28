-- Migration 084: Phase A production hardening
-- Forward-only fixes for advance/rating/summary/top-customers safety.

--------------------------------------------------------------------------------
-- 1) Secure search_path on advance helpers
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_customer_balance_from_net(
  p_customer_id uuid,
  p_signed_net numeric,
  p_actor uuid,
  p_total_paid_delta numeric DEFAULT 0,
  p_total_spent_delta numeric DEFAULT 0
) RETURNS numeric
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_due numeric(14, 2);
  v_advance numeric(14, 2);
BEGIN
  -- Ledger net sign convention: debit increases receivable (due), credit decreases it.
  -- due = max(0, net); advance = max(0, -net); mutually exclusive.
  v_due := greatest(0, coalesce(p_signed_net, 0));
  v_advance := greatest(0, -coalesce(p_signed_net, 0));

  UPDATE public.customers
  SET current_due = v_due,
      current_advance = v_advance,
      total_paid = total_paid + coalesce(p_total_paid_delta, 0),
      total_spent = total_spent + coalesce(p_total_spent_delta, 0),
      updated_by = p_actor,
      updated_at = timezone('utc', now())
  WHERE id = p_customer_id;

  RETURN coalesce(p_signed_net, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public._post_customer_ledger_entry(
  p_org_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_entry_type text,
  p_debit numeric,
  p_credit numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_notes text,
  p_actor uuid,
  p_total_paid_delta numeric DEFAULT 0,
  p_total_spent_delta numeric DEFAULT 0,
  p_skip_party_update boolean DEFAULT false
) RETURNS numeric
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_due numeric(14, 2);
  v_prev_advance numeric(14, 2);
  v_balance numeric(14, 2);
BEGIN
  IF p_debit < 0 OR p_credit < 0 THEN
    RAISE EXCEPTION 'Ledger debit/credit cannot be negative';
  END IF;
  IF (p_debit > 0 AND p_credit > 0) OR (p_debit = 0 AND p_credit = 0) THEN
    RAISE EXCEPTION 'Ledger entry must have debit OR credit';
  END IF;

  SELECT c.current_due, c.current_advance
  INTO v_prev_due, v_prev_advance
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.organization_id = p_org_id
    AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF p_skip_party_update THEN
    SELECT coalesce(sum(cl.debit - cl.credit), 0)
    INTO v_balance
    FROM public.customer_ledger cl
    WHERE cl.customer_id = p_customer_id
      AND cl.deleted_at IS NULL;
    v_balance := v_balance + p_debit - p_credit;
  ELSE
    v_balance := public._apply_customer_balance_from_net(
      p_customer_id,
      coalesce(v_prev_due, 0) - coalesce(v_prev_advance, 0) + p_debit - p_credit,
      p_actor,
      p_total_paid_delta,
      p_total_spent_delta
    );
  END IF;

  INSERT INTO public.customer_ledger (
    organization_id, branch_id, customer_id, entry_type,
    debit, credit, balance_after, reference_type, reference_id,
    notes, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_customer_id, p_entry_type,
    p_debit, p_credit, v_balance, p_reference_type, p_reference_id,
    p_notes, p_actor, p_actor
  );

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_customer_balance_from_net(uuid, numeric, uuid, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_customer_balance_from_net(uuid, numeric, uuid, numeric, numeric)
  TO service_role;

REVOKE ALL ON FUNCTION public._post_customer_ledger_entry(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, uuid, numeric, numeric, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._post_customer_ledger_entry(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, uuid, numeric, numeric, boolean)
  TO service_role;

--------------------------------------------------------------------------------
-- 2) Rating summary: status + nullable score (unrated ≠ 3.0 fake average)
--------------------------------------------------------------------------------
ALTER TABLE public.customer_rating_summaries
  ADD COLUMN IF NOT EXISTS rating_status text NOT NULL DEFAULT 'unrated';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_rating_summaries_status_check'
  ) THEN
    ALTER TABLE public.customer_rating_summaries
      ADD CONSTRAINT customer_rating_summaries_status_check
      CHECK (rating_status IN ('unrated', 'provisional', 'rated'));
  END IF;
END $$;

-- Allow NULL score for unrated customers
ALTER TABLE public.customer_rating_summaries
  ALTER COLUMN score DROP DEFAULT;

ALTER TABLE public.customer_rating_summaries
  ALTER COLUMN score DROP NOT NULL;

ALTER TABLE public.customer_rating_summaries
  DROP CONSTRAINT IF EXISTS customer_rating_summaries_score_check;

ALTER TABLE public.customer_rating_summaries
  ADD CONSTRAINT customer_rating_summaries_score_check
  CHECK (score IS NULL OR (score >= 1.0 AND score <= 5.0));

-- Clients must not forge ratings; only SECURITY DEFINER RPCs write rows
DROP POLICY IF EXISTS customer_rating_summaries_write ON public.customer_rating_summaries;

DROP TRIGGER IF EXISTS customer_rating_summaries_set_updated_at ON public.customer_rating_summaries;
CREATE TRIGGER customer_rating_summaries_set_updated_at
  BEFORE UPDATE ON public.customer_rating_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- 3) Supporting indexes for summary / rating aggregations
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sales_customer_completed_idx
  ON public.sales (organization_id, customer_id, completed_at DESC)
  WHERE deleted_at IS NULL AND status = 'completed';

CREATE INDEX IF NOT EXISTS sale_returns_org_status_idx
  ON public.sale_returns (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customers_org_status_spent_idx
  ON public.customers (organization_id, status, total_spent DESC)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- 4) Rating formula (documented) + unrated/provisional/rated
--------------------------------------------------------------------------------
-- Formula (deterministic):
--   frequency_score   = clamp(1 + 4 * min(1, ln(1+freq_30d)/ln(1+2*org_avg_freq)))   weight 20%
--   amount_score      = clamp(1 + 4 * min(1, ln(1+total_spent)/ln(1+2*org_avg_spent))) weight 25%
--   orders_score      = clamp(1 + 4 * min(1, ln(1+orders)/ln(1+2*org_avg_orders)))     weight 20%
--   return_score      = clamp(5 - 4 * min(1, return_total/max(total_spent,1)))         weight 15%
--   payment_score     = clamp(5 - 3.5*overdue_ratio + advance_bonus + recency_bonus)  weight 20%
--   final             = weighted sum, clamped to [1.0, 5.0]
-- Status:
--   0 completed orders → unrated (score NULL)
--   1 completed order  → provisional
--   2+ completed       → rated

CREATE OR REPLACE FUNCTION public.refresh_customer_rating(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_branch_id uuid;
  v_actor uuid := public.current_profile_id();
  v_session_org uuid := public.current_organization_id();
  v_completed_count int := 0;
  v_total_spent numeric := 0;
  v_return_count int := 0;
  v_return_total numeric := 0;
  v_last_purchase timestamptz;
  v_first_purchase timestamptz;
  v_days_span numeric := 1;
  v_frequency numeric := 0;
  v_avg_order numeric := 0;
  v_due numeric := 0;
  v_advance numeric := 0;
  v_overdue_ratio numeric := 0;
  v_org_avg_spent numeric := 1;
  v_org_avg_orders numeric := 1;
  v_org_avg_freq numeric := 1;
  v_f_freq numeric;
  v_f_amount numeric;
  v_f_orders numeric;
  v_f_return numeric;
  v_f_payment numeric;
  v_score numeric;
  v_status text;
  v_factors jsonb;
BEGIN
  SELECT c.organization_id, c.branch_id, c.current_due, c.current_advance
  INTO v_org_id, v_branch_id, v_due, v_advance
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Deny cross-org when called from an authenticated session
  IF v_session_org IS NOT NULL AND v_session_org <> v_org_id THEN
    RAISE EXCEPTION 'Organization mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*)::int,
    coalesce(sum(s.grand_total), 0),
    max(s.completed_at),
    min(s.completed_at)
  INTO v_completed_count, v_total_spent, v_last_purchase, v_first_purchase
  FROM public.sales s
  WHERE s.customer_id = p_customer_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND s.status = 'completed';

  SELECT
    count(*)::int,
    coalesce(sum(sr.total), 0)
  INTO v_return_count, v_return_total
  FROM public.sale_returns sr
  JOIN public.sales s ON s.id = sr.sale_id AND s.deleted_at IS NULL
  WHERE s.customer_id = p_customer_id
    AND sr.organization_id = v_org_id
    AND sr.deleted_at IS NULL
    AND sr.status = 'completed';

  -- Fast path: no purchase history → unrated (do not invent 3.0)
  IF v_completed_count = 0 THEN
    v_status := 'unrated';
    v_score := NULL;
    v_factors := jsonb_build_object(
      'weights', jsonb_build_object(
        'purchase_frequency', 0.20,
        'total_sales_amount', 0.25,
        'completed_orders', 0.20,
        'return_ratio', 0.15,
        'payment_behaviour', 0.20
      ),
      'raw', jsonb_build_object(
        'completed_count', 0,
        'total_spent', 0,
        'return_count', v_return_count,
        'return_total', v_return_total,
        'current_due', v_due,
        'current_advance', v_advance
      )
    );

    INSERT INTO public.customer_rating_summaries AS crs (
      organization_id, customer_id, branch_id, score, rating_status, factors,
      computed_at, created_by, updated_by
    ) VALUES (
      v_org_id, p_customer_id, v_branch_id, NULL, v_status, v_factors,
      timezone('utc', now()), v_actor, v_actor
    )
    ON CONFLICT (organization_id, customer_id) WHERE deleted_at IS NULL
    DO UPDATE SET
      score = NULL,
      rating_status = 'unrated',
      factors = excluded.factors,
      computed_at = excluded.computed_at,
      updated_by = excluded.updated_by,
      updated_at = timezone('utc', now()),
      deleted_at = NULL;

    RETURN jsonb_build_object(
      'customer_id', p_customer_id,
      'score', NULL,
      'rating_status', v_status,
      'factors', v_factors,
      'computed_at', timezone('utc', now())
    );
  END IF;

  v_status := CASE WHEN v_completed_count = 1 THEN 'provisional' ELSE 'rated' END;

  v_days_span := greatest(
    1,
    extract(epoch FROM (timezone('utc', now()) - coalesce(v_first_purchase, timezone('utc', now())))) / 86400.0
  );
  v_frequency := (v_completed_count::numeric / v_days_span) * 30.0;
  v_avg_order := CASE WHEN v_completed_count > 0 THEN v_total_spent / v_completed_count ELSE 0 END;

  SELECT
    greatest(1, coalesce(avg(NULLIF(c.total_spent, 0)), 1)),
    greatest(1, coalesce(avg(
      (SELECT count(*)::numeric
       FROM public.sales s
       WHERE s.customer_id = c.id
         AND s.status = 'completed'
         AND s.deleted_at IS NULL
         AND s.organization_id = v_org_id)
    ), 1))
  INTO v_org_avg_spent, v_org_avg_orders
  FROM public.customers c
  WHERE c.organization_id = v_org_id
    AND c.deleted_at IS NULL
    AND c.status = 'active';

  v_org_avg_freq := greatest(0.5, v_org_avg_orders / 6.0);

  v_f_freq := public._rating_factor_from_ratio(
    ln(1 + v_frequency) / nullif(ln(1 + greatest(v_org_avg_freq * 2, 1)), 0)
  );
  v_f_amount := public._rating_factor_from_ratio(
    ln(1 + v_total_spent) / nullif(ln(1 + greatest(v_org_avg_spent * 2, 1)), 0)
  );
  v_f_orders := public._rating_factor_from_ratio(
    ln(1 + v_completed_count) / nullif(ln(1 + greatest(v_org_avg_orders * 2, 1)), 0)
  );

  v_f_return := public._rating_clamp(
    5.0 - 4.0 * least(
      1.0,
      CASE
        WHEN v_total_spent <= 0 THEN least(1.0, v_return_count::numeric / greatest(v_completed_count, 1))
        ELSE v_return_total / greatest(v_total_spent, 1)
      END
    )
  );

  IF v_due > 0 AND (v_last_purchase IS NULL OR v_last_purchase < timezone('utc', now()) - interval '45 days') THEN
    v_overdue_ratio := least(1.0, v_due / greatest(v_avg_order, v_due, 1));
  ELSIF v_due > 0 THEN
    v_overdue_ratio := least(0.6, v_due / greatest(v_avg_order, v_due, 1));
  ELSE
    v_overdue_ratio := 0;
  END IF;

  v_f_payment := public._rating_clamp(
    5.0
    - 3.5 * v_overdue_ratio
    + CASE WHEN v_advance > 0 THEN 0.3 ELSE 0 END
    + CASE
        WHEN v_last_purchase IS NOT NULL
             AND v_last_purchase >= timezone('utc', now()) - interval '30 days'
        THEN 0.2 ELSE 0
      END
  );

  v_score := public._rating_clamp(
    coalesce(v_f_freq, 3) * 0.20
    + coalesce(v_f_amount, 3) * 0.25
    + coalesce(v_f_orders, 3) * 0.20
    + coalesce(v_f_return, 3) * 0.15
    + coalesce(v_f_payment, 3) * 0.20
  );

  v_factors := jsonb_build_object(
    'purchase_frequency', v_f_freq,
    'total_sales_amount', v_f_amount,
    'completed_orders', v_f_orders,
    'return_ratio', v_f_return,
    'payment_behaviour', v_f_payment,
    'weights', jsonb_build_object(
      'purchase_frequency', 0.20,
      'total_sales_amount', 0.25,
      'completed_orders', 0.20,
      'return_ratio', 0.15,
      'payment_behaviour', 0.20
    ),
    'raw', jsonb_build_object(
      'completed_count', v_completed_count,
      'total_spent', v_total_spent,
      'return_count', v_return_count,
      'return_total', v_return_total,
      'frequency_per_30d', round(v_frequency::numeric, 3),
      'current_due', v_due,
      'current_advance', v_advance,
      'last_purchase_at', v_last_purchase
    )
  );

  INSERT INTO public.customer_rating_summaries AS crs (
    organization_id, customer_id, branch_id, score, rating_status, factors,
    computed_at, created_by, updated_by
  ) VALUES (
    v_org_id, p_customer_id, v_branch_id, v_score, v_status, v_factors,
    timezone('utc', now()), v_actor, v_actor
  )
  ON CONFLICT (organization_id, customer_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    score = excluded.score,
    rating_status = excluded.rating_status,
    factors = excluded.factors,
    computed_at = excluded.computed_at,
    updated_by = excluded.updated_by,
    updated_at = timezone('utc', now()),
    deleted_at = NULL;

  RETURN jsonb_build_object(
    'customer_id', p_customer_id,
    'score', v_score,
    'rating_status', v_status,
    'factors', v_factors,
    'computed_at', timezone('utc', now())
  );
END;
$$;

--------------------------------------------------------------------------------
-- 5) POS summary: no write on read; return rating_status; mutual exclusive balances
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pos_customer_summary(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_row record;
  v_completed_count int := 0;
  v_return_count int := 0;
  v_return_total numeric := 0;
  v_last_purchase timestamptz;
  v_rating numeric;
  v_rating_status text;
  v_financial_status text;
  v_due numeric(14, 2);
  v_advance numeric(14, 2);
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.user_has_permission('customers.read')
    OR public.user_has_permission('customers.manage')
    OR public.user_has_permission('pos.create')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT
    c.id, c.name, c.phone, c.email, c.address, c.district, c.status,
    c.current_due, c.current_advance, c.total_spent, c.total_paid
  INTO v_row
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.organization_id = v_org_id
    AND c.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found' USING ERRCODE = 'P0002';
  END IF;

  -- Enforce mutual exclusivity from denormalized caches (ledger is source of truth)
  v_due := greatest(0, coalesce(v_row.current_due, 0));
  v_advance := greatest(0, coalesce(v_row.current_advance, 0));
  IF v_due > 0 AND v_advance > 0 THEN
    -- Prefer due when caches are inconsistent; caller should sync
    v_advance := 0;
  END IF;

  SELECT count(*)::int, max(s.completed_at)
  INTO v_completed_count, v_last_purchase
  FROM public.sales s
  WHERE s.customer_id = p_customer_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND s.status = 'completed';

  SELECT count(*)::int, coalesce(sum(sr.total), 0)
  INTO v_return_count, v_return_total
  FROM public.sale_returns sr
  JOIN public.sales s ON s.id = sr.sale_id AND s.deleted_at IS NULL
  WHERE s.customer_id = p_customer_id
    AND sr.organization_id = v_org_id
    AND sr.deleted_at IS NULL
    AND sr.status = 'completed';

  SELECT crs.score, crs.rating_status
  INTO v_rating, v_rating_status
  FROM public.customer_rating_summaries crs
  WHERE crs.customer_id = p_customer_id
    AND crs.organization_id = v_org_id
    AND crs.deleted_at IS NULL;

  IF v_rating_status IS NULL THEN
    v_rating_status := CASE WHEN v_completed_count = 0 THEN 'unrated' ELSE 'provisional' END;
    v_rating := NULL;
  END IF;

  IF v_due > 0 THEN
    v_financial_status := 'due';
  ELSIF v_advance > 0 THEN
    v_financial_status := 'advance';
  ELSE
    v_financial_status := 'settled';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'phone', v_row.phone,
    'email', v_row.email,
    'address', v_row.address,
    'district', v_row.district,
    'status', v_row.status,
    'current_due', v_due,
    'current_advance', v_advance,
    'total_spent', v_row.total_spent,
    'total_paid', v_row.total_paid,
    'completed_orders', v_completed_count,
    'return_count', v_return_count,
    'return_total', v_return_total,
    'last_purchase_at', v_last_purchase,
    'rating', v_rating,
    'rating_status', v_rating_status,
    'financial_status', v_financial_status
  );
END;
$$;

--------------------------------------------------------------------------------
-- 6) Top customers: search, sort, offset, returns — no fake 3.0 for unrated
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_top_customers(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_limit int := greatest(1, least(coalesce((payload->>'limit')::int, 20), 100));
  v_offset int := greatest(0, coalesce((payload->>'offset')::int, 0));
  v_sort text := lower(coalesce(NULLIF(payload->>'sort', ''), 'spent'));
  v_search text := NULLIF(btrim(coalesce(payload->>'search', '')), '');
  v_branch_id uuid := NULLIF(payload->>'branch_id', '')::uuid;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.user_has_permission('customers.read')
    OR public.user_has_permission('reports.read')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  IF v_sort NOT IN ('rating', 'spent', 'orders', 'recent') THEN
    v_sort := 'spent';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.rank)
    FROM (
      SELECT
        row_number() OVER ()::int AS rank,
        q.*
      FROM (
        SELECT
          c.id,
          c.name,
          c.phone,
          c.current_due,
          c.current_advance,
          c.total_spent,
          c.status,
          crs.score AS rating,
          coalesce(crs.rating_status, 'unrated') AS rating_status,
          (
            SELECT count(*)::int
            FROM public.sales s
            WHERE s.customer_id = c.id
              AND s.organization_id = v_org_id
              AND s.status = 'completed'
              AND s.deleted_at IS NULL
              AND (v_branch_id IS NULL OR s.branch_id = v_branch_id)
          ) AS completed_orders,
          (
            SELECT coalesce(sum(sr.total), 0)
            FROM public.sale_returns sr
            JOIN public.sales s ON s.id = sr.sale_id AND s.deleted_at IS NULL
            WHERE s.customer_id = c.id
              AND sr.organization_id = v_org_id
              AND sr.status = 'completed'
              AND sr.deleted_at IS NULL
          ) AS return_total,
          (
            SELECT max(s.completed_at)
            FROM public.sales s
            WHERE s.customer_id = c.id
              AND s.organization_id = v_org_id
              AND s.status = 'completed'
              AND s.deleted_at IS NULL
              AND (v_branch_id IS NULL OR s.branch_id = v_branch_id)
          ) AS last_purchase_at
        FROM public.customers c
        LEFT JOIN public.customer_rating_summaries crs
          ON crs.customer_id = c.id
         AND crs.organization_id = c.organization_id
         AND crs.deleted_at IS NULL
        WHERE c.organization_id = v_org_id
          AND c.deleted_at IS NULL
          AND c.status = 'active'
          AND (
            v_search IS NULL
            OR c.name ILIKE '%' || v_search || '%'
            OR c.phone ILIKE '%' || v_search || '%'
          )
          AND (
            v_branch_id IS NULL
            OR c.branch_id = v_branch_id
            OR EXISTS (
              SELECT 1 FROM public.sales s
              WHERE s.customer_id = c.id
                AND s.branch_id = v_branch_id
                AND s.deleted_at IS NULL
            )
          )
        ORDER BY
          CASE WHEN v_sort = 'spent' THEN c.total_spent END DESC NULLS LAST,
          CASE WHEN v_sort = 'orders' THEN (
            SELECT count(*)::numeric FROM public.sales s
            WHERE s.customer_id = c.id AND s.status = 'completed' AND s.deleted_at IS NULL
          ) END DESC NULLS LAST,
          CASE WHEN v_sort = 'rating' THEN crs.score END DESC NULLS LAST,
          CASE WHEN v_sort = 'recent' THEN (
            SELECT max(s.completed_at) FROM public.sales s
            WHERE s.customer_id = c.id AND s.status = 'completed' AND s.deleted_at IS NULL
          ) END DESC NULLS LAST,
          c.total_spent DESC,
          c.name ASC
        LIMIT v_limit
        OFFSET v_offset
      ) q
    ) t
  ), '[]'::jsonb);
END;
$$;

-- Keep legacy (int, text) signature as thin wrapper
CREATE OR REPLACE FUNCTION public.list_top_customers(
  p_limit int DEFAULT 20,
  p_sort text DEFAULT 'rating'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.list_top_customers(jsonb_build_object(
    'limit', p_limit,
    'sort', p_sort,
    'offset', 0
  ));
END;
$$;

--------------------------------------------------------------------------------
-- 7) Deduplicate rating refresh: drop ledger trigger for sale_* (sale trigger covers)
--    Keep collection/refund only to avoid N refreshes per POS sale
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_refresh_customer_rating_on_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.entry_type IN ('collection', 'refund') THEN
    PERFORM public._maybe_refresh_customer_rating(NEW.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Also refresh on voided sales (status leaving completed)
CREATE OR REPLACE FUNCTION public.trg_refresh_customer_rating_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.customer_id IS NULL AND (TG_OP = 'UPDATE' AND OLD.customer_id IS NULL) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'completed' AND NEW.customer_id IS NOT NULL THEN
    PERFORM public._maybe_refresh_customer_rating(NEW.customer_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed'
       AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
       AND NEW.customer_id IS NOT NULL THEN
      PERFORM public._maybe_refresh_customer_rating(NEW.customer_id);
    ELSIF OLD.status = 'completed'
       AND NEW.status IS DISTINCT FROM 'completed'
       AND coalesce(NEW.customer_id, OLD.customer_id) IS NOT NULL THEN
      PERFORM public._maybe_refresh_customer_rating(coalesce(NEW.customer_id, OLD.customer_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

--------------------------------------------------------------------------------
-- 8) Permissions: batch refresh requires manage; helpers stay internal
--------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.refresh_customer_ratings_batch(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_customer_ratings_batch(uuid[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public._maybe_refresh_customer_rating(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._maybe_refresh_customer_rating(uuid) TO service_role;

REVOKE ALL ON FUNCTION public._rating_clamp(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._rating_factor_from_ratio(numeric) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_customer_rating(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pos_customer_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_top_customers(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_top_customers(int, text) TO authenticated, service_role;
