-- Migration 102: Supplier rating summaries (mirrors customer rating)

CREATE TABLE IF NOT EXISTS public.supplier_rating_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id),
  branch_id uuid REFERENCES public.branches (id),
  score numeric(3, 1) CHECK (score IS NULL OR (score >= 1.0 AND score <= 5.0)),
  rating_status text NOT NULL DEFAULT 'unrated'
    CHECK (rating_status IN ('unrated', 'provisional', 'rated')),
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_rating_summaries_org_supplier_uidx
  ON public.supplier_rating_summaries (organization_id, supplier_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS supplier_rating_summaries_org_score_idx
  ON public.supplier_rating_summaries (organization_id, score DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE TRIGGER supplier_rating_summaries_set_updated_at
  BEFORE UPDATE ON public.supplier_rating_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.supplier_rating_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_rating_summaries_select ON public.supplier_rating_summaries;
CREATE POLICY supplier_rating_summaries_select
  ON public.supplier_rating_summaries
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('suppliers.read')
      OR public.user_has_permission('suppliers.manage')
      OR public.user_has_permission('purchases.read')
    )
  );

DROP POLICY IF EXISTS supplier_rating_summaries_write ON public.supplier_rating_summaries;
CREATE POLICY supplier_rating_summaries_write
  ON public.supplier_rating_summaries
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('suppliers.manage')
      OR public.user_has_permission('accounts.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('suppliers.manage')
      OR public.user_has_permission('accounts.manage')
    )
  );

GRANT SELECT ON public.supplier_rating_summaries TO authenticated;
GRANT ALL ON public.supplier_rating_summaries TO service_role;

--------------------------------------------------------------------------------
-- refresh_supplier_rating
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_supplier_rating(p_supplier_id uuid)
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
  v_purchase_count int := 0;
  v_total_purchased numeric := 0;
  v_return_count int := 0;
  v_return_total numeric := 0;
  v_due numeric := 0;
  v_on_time int := 0;
  v_score numeric;
  v_status text;
  v_factors jsonb;
BEGIN
  SELECT s.organization_id, s.branch_id, s.current_due
  INTO v_org_id, v_branch_id, v_due
  FROM public.suppliers s
  WHERE s.id = p_supplier_id AND s.deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  IF v_session_org IS NOT NULL AND v_session_org <> v_org_id THEN
    RAISE EXCEPTION 'Organization mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::int, coalesce(sum(p.grand_total), 0)
  INTO v_purchase_count, v_total_purchased
  FROM public.purchases p
  WHERE p.supplier_id = p_supplier_id
    AND p.organization_id = v_org_id
    AND p.deleted_at IS NULL
    AND p.status = 'completed';

  SELECT count(*)::int, coalesce(sum(pr.total), 0)
  INTO v_return_count, v_return_total
  FROM public.purchase_returns pr
  JOIN public.purchases p ON p.id = pr.purchase_id
  WHERE p.supplier_id = p_supplier_id
    AND pr.organization_id = v_org_id
    AND pr.deleted_at IS NULL
    AND pr.status = 'completed';

  IF v_purchase_count = 0 THEN
    v_status := 'unrated';
    v_score := NULL;
  ELSIF v_purchase_count < 2 THEN
    v_status := 'provisional';
    v_score := 3.0;
  ELSE
    v_status := 'rated';
    -- Higher score = reliable supplier: low return ratio, moderate due, purchase volume
    v_score := greatest(1.0, least(5.0, round((
      3.5
      + least(v_total_purchased / 100000.0, 1.0)
      - least(v_return_total / nullif(v_total_purchased, 0), 1.0) * 2.0
      - least(v_due / nullif(v_total_purchased, 0), 1.0) * 0.5
    )::numeric, 1)));
  END IF;

  v_factors := jsonb_build_object(
    'purchase_count', v_purchase_count,
    'total_purchased', v_total_purchased,
    'return_count', v_return_count,
    'return_total', v_return_total,
    'current_due', v_due,
    'on_time_deliveries', v_on_time
  );

  INSERT INTO public.supplier_rating_summaries AS srs (
    organization_id, supplier_id, branch_id, score, rating_status, factors,
    computed_at, created_by, updated_by
  ) VALUES (
    v_org_id, p_supplier_id, v_branch_id, v_score, v_status, v_factors,
    timezone('utc', now()), v_actor, v_actor
  )
  ON CONFLICT (organization_id, supplier_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    score = excluded.score,
    rating_status = excluded.rating_status,
    factors = excluded.factors,
    computed_at = excluded.computed_at,
    updated_by = excluded.updated_by,
    updated_at = timezone('utc', now()),
    deleted_at = NULL;

  RETURN jsonb_build_object(
    'supplier_id', p_supplier_id,
    'score', v_score,
    'rating_status', v_status,
    'factors', v_factors,
    'computed_at', timezone('utc', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_supplier_rating(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_supplier_rating(uuid) TO authenticated, service_role;
