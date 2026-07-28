-- Migration 077: POS customer summary + automatic customer rating RPCs

--------------------------------------------------------------------------------
-- Rating helpers: clamp 1..5, log-normalize within org baselines
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._rating_clamp(p_value numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(greatest(1.0, least(5.0, coalesce(p_value, 3.0)))::numeric, 1);
$$;

CREATE OR REPLACE FUNCTION public._rating_factor_from_ratio(p_ratio numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  -- p_ratio expected ~0..1+ ; map to 1..5 with soft cap
  SELECT public._rating_clamp(1.0 + 4.0 * least(1.0, greatest(0, coalesce(p_ratio, 0))));
$$;

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
  v_factors jsonb;
BEGIN
  SELECT c.organization_id, c.branch_id, c.current_due, c.current_advance, c.total_spent
  INTO v_org_id, v_branch_id, v_due, v_advance, v_total_spent
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_actor IS NOT NULL
     AND public.current_organization_id() IS NOT NULL
     AND public.current_organization_id() <> v_org_id THEN
    RAISE EXCEPTION 'Organization mismatch';
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
  JOIN public.sales s ON s.id = sr.sale_id
  WHERE s.customer_id = p_customer_id
    AND sr.organization_id = v_org_id
    AND sr.deleted_at IS NULL
    AND sr.status = 'completed';

  v_days_span := greatest(
    1,
    extract(epoch FROM (timezone('utc', now()) - coalesce(v_first_purchase, timezone('utc', now())))) / 86400.0
  );
  -- Purchases per 30 days
  v_frequency := (v_completed_count::numeric / v_days_span) * 30.0;
  v_avg_order := CASE WHEN v_completed_count > 0 THEN v_total_spent / v_completed_count ELSE 0 END;

  SELECT
    greatest(1, avg(NULLIF(c.total_spent, 0))),
    greatest(1, avg(
      (SELECT count(*)::numeric
       FROM public.sales s
       WHERE s.customer_id = c.id AND s.status = 'completed' AND s.deleted_at IS NULL)
    ))
  INTO v_org_avg_spent, v_org_avg_orders
  FROM public.customers c
  WHERE c.organization_id = v_org_id
    AND c.deleted_at IS NULL
    AND c.status = 'active';

  v_org_avg_freq := greatest(0.5, v_org_avg_orders / 6.0);

  -- Factor scores (1–5), log-capped vs org averages so one large order cannot force 5★
  v_f_freq := public._rating_factor_from_ratio(
    ln(1 + v_frequency) / ln(1 + greatest(v_org_avg_freq * 2, 1))
  );
  v_f_amount := public._rating_factor_from_ratio(
    ln(1 + v_total_spent) / ln(1 + greatest(v_org_avg_spent * 2, 1))
  );
  v_f_orders := public._rating_factor_from_ratio(
    ln(1 + v_completed_count) / ln(1 + greatest(v_org_avg_orders * 2, 1))
  );

  -- Lower return ratio → higher score
  v_f_return := public._rating_clamp(
    5.0 - 4.0 * least(
      1.0,
      CASE
        WHEN v_total_spent <= 0 AND v_completed_count = 0 THEN 0.3
        WHEN v_total_spent <= 0 THEN least(1.0, v_return_count::numeric / greatest(v_completed_count, 1))
        ELSE v_return_total / greatest(v_total_spent, 1)
      END
    )
  );

  -- Payment behaviour: due hurts, advance/settled helps; overdue = due with no recent purchase > 45d
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
        THEN 0.2
        ELSE 0
      END
  );

  -- Weighted score
  v_score := public._rating_clamp(
    v_f_freq * 0.20
    + v_f_amount * 0.25
    + v_f_orders * 0.20
    + v_f_return * 0.15
    + v_f_payment * 0.20
  );

  -- New customers with no history stay neutral 3.0
  IF v_completed_count = 0 AND v_return_count = 0 THEN
    v_score := 3.0;
  END IF;

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
    organization_id, customer_id, branch_id, score, factors, computed_at, created_by, updated_by
  ) VALUES (
    v_org_id, p_customer_id, v_branch_id, v_score, v_factors, timezone('utc', now()), v_actor, v_actor
  )
  ON CONFLICT (organization_id, customer_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    score = excluded.score,
    factors = excluded.factors,
    computed_at = excluded.computed_at,
    updated_by = excluded.updated_by,
    updated_at = timezone('utc', now()),
    deleted_at = NULL;

  RETURN jsonb_build_object(
    'customer_id', p_customer_id,
    'score', v_score,
    'factors', v_factors,
    'computed_at', timezone('utc', now())
  );
END;
$$;

-- Unique partial index name must match ON CONFLICT — ensure constraint usable
-- Postgres requires a unique index for ON CONFLICT with WHERE; already created in 076.

CREATE OR REPLACE FUNCTION public.refresh_customer_ratings_batch(p_customer_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  r record;
  v_count int := 0;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR r IN
    SELECT c.id
    FROM public.customers c
    WHERE c.organization_id = v_org_id
      AND c.deleted_at IS NULL
      AND (p_customer_ids IS NULL OR c.id = ANY (p_customer_ids))
  LOOP
    PERFORM public.refresh_customer_rating(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('refreshed', v_count);
END;
$$;

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
  v_financial_status text;
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
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    c.address,
    c.district,
    c.status,
    c.current_due,
    c.current_advance,
    c.total_spent,
    c.total_paid
  INTO v_row
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.organization_id = v_org_id
    AND c.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
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
  JOIN public.sales s ON s.id = sr.sale_id
  WHERE s.customer_id = p_customer_id
    AND sr.organization_id = v_org_id
    AND sr.deleted_at IS NULL
    AND sr.status = 'completed';

  SELECT crs.score
  INTO v_rating
  FROM public.customer_rating_summaries crs
  WHERE crs.customer_id = p_customer_id
    AND crs.organization_id = v_org_id
    AND crs.deleted_at IS NULL;

  IF v_rating IS NULL THEN
    -- Lazy compute once for POS (lightweight relative to full ledger)
    v_rating := (public.refresh_customer_rating(p_customer_id)->>'score')::numeric;
  END IF;

  IF coalesce(v_row.current_due, 0) > 0 THEN
    v_financial_status := 'due';
  ELSIF coalesce(v_row.current_advance, 0) > 0 THEN
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
    'current_due', v_row.current_due,
    'current_advance', v_row.current_advance,
    'total_spent', v_row.total_spent,
    'total_paid', v_row.total_paid,
    'completed_orders', v_completed_count,
    'return_count', v_return_count,
    'return_total', v_return_total,
    'last_purchase_at', v_last_purchase,
    'rating', v_rating,
    'financial_status', v_financial_status
  );
END;
$$;

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
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.user_has_permission('customers.read')
    OR public.user_has_permission('reports.read')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t)::jsonb)
    FROM (
      SELECT
        c.id,
        c.name,
        c.phone,
        c.current_due,
        c.current_advance,
        c.total_spent,
        c.status,
        coalesce(crs.score, 3.0) AS rating,
        (
          SELECT count(*)::int
          FROM public.sales s
          WHERE s.customer_id = c.id
            AND s.status = 'completed'
            AND s.deleted_at IS NULL
        ) AS completed_orders,
        (
          SELECT max(s.completed_at)
          FROM public.sales s
          WHERE s.customer_id = c.id
            AND s.status = 'completed'
            AND s.deleted_at IS NULL
        ) AS last_purchase_at
      FROM public.customers c
      LEFT JOIN public.customer_rating_summaries crs
        ON crs.customer_id = c.id
       AND crs.organization_id = c.organization_id
       AND crs.deleted_at IS NULL
      WHERE c.organization_id = v_org_id
        AND c.deleted_at IS NULL
        AND c.status = 'active'
      ORDER BY
        CASE WHEN lower(coalesce(p_sort, 'rating')) = 'spent' THEN c.total_spent END DESC NULLS LAST,
        CASE WHEN lower(coalesce(p_sort, 'rating')) <> 'spent' THEN coalesce(crs.score, 3.0) END DESC NULLS LAST,
        c.total_spent DESC
      LIMIT v_limit
    ) t
  ), '[]'::jsonb);
END;
$$;

-- Hook rating refresh into collection (non-blocking best-effort via same txn)
CREATE OR REPLACE FUNCTION public._maybe_refresh_customer_rating(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    PERFORM public.refresh_customer_rating(p_customer_id);
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the financial transaction because of rating
    NULL;
  END;
END;
$$;

--------------------------------------------------------------------------------
-- Event hooks: refresh rating after sale complete / return / collection
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_refresh_customer_rating_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    PERFORM public._maybe_refresh_customer_rating(NEW.customer_id);
  ELSIF TG_OP = 'UPDATE'
       AND NEW.status = 'completed'
       AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    PERFORM public._maybe_refresh_customer_rating(NEW.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_refresh_customer_rating ON public.sales;
CREATE TRIGGER sales_refresh_customer_rating
  AFTER INSERT OR UPDATE OF status, deleted_at ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_customer_rating_on_sale();

CREATE OR REPLACE FUNCTION public.trg_refresh_customer_rating_on_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  SELECT s.customer_id INTO v_customer_id
  FROM public.sales s
  WHERE s.id = NEW.sale_id;
  PERFORM public._maybe_refresh_customer_rating(v_customer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_returns_refresh_customer_rating ON public.sale_returns;
CREATE TRIGGER sale_returns_refresh_customer_rating
  AFTER INSERT OR UPDATE OF status ON public.sale_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_customer_rating_on_return();

CREATE OR REPLACE FUNCTION public.trg_refresh_customer_rating_on_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.entry_type IN ('collection', 'return_credit', 'refund', 'sale_payment', 'sale_invoice') THEN
    PERFORM public._maybe_refresh_customer_rating(NEW.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_ledger_refresh_rating ON public.customer_ledger;
CREATE TRIGGER customer_ledger_refresh_rating
  AFTER INSERT ON public.customer_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_customer_rating_on_ledger();

GRANT EXECUTE ON FUNCTION public.refresh_customer_rating(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_customer_ratings_batch(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pos_customer_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_top_customers(int, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._maybe_refresh_customer_rating(uuid) TO service_role;
REVOKE ALL ON FUNCTION public._rating_clamp(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._rating_factor_from_ratio(numeric) FROM PUBLIC;
