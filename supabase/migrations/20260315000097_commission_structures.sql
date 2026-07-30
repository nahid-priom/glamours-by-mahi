-- Migration 097: Custom commission structures (employee OR profile subjects,
-- per-sale / sale-amount tiers / period volume tiers) + accrue on sale complete.

--------------------------------------------------------------------------------
-- Schema extensions
--------------------------------------------------------------------------------
ALTER TABLE public.salesman_commission_rules
  ADD COLUMN IF NOT EXISTS subject_type text,
  ADD COLUMN IF NOT EXISTS structure_mode text NOT NULL DEFAULT 'per_sale',
  ADD COLUMN IF NOT EXISTS base_metric text NOT NULL DEFAULT 'sale_total',
  ADD COLUMN IF NOT EXISTS tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS period_unit text NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS applies_to_sources text[] NOT NULL DEFAULT ARRAY['pos', 'moderator', 'tele_sales', 'ecommerce', 'manual', 'other']::text[];

-- Backfill subject_type from existing rows
UPDATE public.salesman_commission_rules
SET subject_type = CASE
  WHEN employee_id IS NOT NULL THEN 'employee'
  WHEN profile_id IS NOT NULL THEN 'profile'
  ELSE 'employee'
END
WHERE subject_type IS NULL;

ALTER TABLE public.salesman_commission_rules
  ALTER COLUMN subject_type SET DEFAULT 'employee';

UPDATE public.salesman_commission_rules
SET subject_type = 'employee'
WHERE subject_type IS NULL;

ALTER TABLE public.salesman_commission_rules
  ALTER COLUMN subject_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salesman_commission_rules_subject_type_chk'
  ) THEN
    ALTER TABLE public.salesman_commission_rules
      ADD CONSTRAINT salesman_commission_rules_subject_type_chk
      CHECK (subject_type IN ('employee', 'profile'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salesman_commission_rules_structure_mode_chk'
  ) THEN
    ALTER TABLE public.salesman_commission_rules
      ADD CONSTRAINT salesman_commission_rules_structure_mode_chk
      CHECK (structure_mode IN ('per_sale', 'sale_amount_tiers', 'period_volume_tiers'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salesman_commission_rules_base_metric_chk'
  ) THEN
    ALTER TABLE public.salesman_commission_rules
      ADD CONSTRAINT salesman_commission_rules_base_metric_chk
      CHECK (base_metric IN ('sale_total', 'profit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salesman_commission_rules_period_unit_chk'
  ) THEN
    ALTER TABLE public.salesman_commission_rules
      ADD CONSTRAINT salesman_commission_rules_period_unit_chk
      CHECK (period_unit IN ('month'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salesman_commission_rules_subject_xor_chk'
  ) THEN
    ALTER TABLE public.salesman_commission_rules
      ADD CONSTRAINT salesman_commission_rules_subject_xor_chk
      CHECK (
        (subject_type = 'employee' AND employee_id IS NOT NULL)
        OR (subject_type = 'profile' AND profile_id IS NOT NULL AND employee_id IS NULL)
      );
  END IF;
END $$;

-- Unique active profile-subject rules (employee unique index already exists)
DROP INDEX IF EXISTS salesman_commission_rules_org_profile_subject_branch_active_uidx;
CREATE UNIQUE INDEX salesman_commission_rules_org_profile_subject_branch_active_uidx
  ON public.salesman_commission_rules (
    organization_id,
    profile_id,
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL
    AND is_active = true
    AND subject_type = 'profile'
    AND profile_id IS NOT NULL;

--------------------------------------------------------------------------------
-- Tier helpers
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._validate_commission_tiers(p_tiers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier jsonb;
  v_prev_min numeric := -1;
  v_min numeric;
  v_max numeric;
  v_rate numeric;
  v_rate_type text;
  v_out jsonb := '[]'::jsonb;
  v_i int := 0;
BEGIN
  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' THEN
    RAISE EXCEPTION 'tiers must be a JSON array';
  END IF;

  FOR v_tier IN
    SELECT value
    FROM jsonb_array_elements(p_tiers) WITH ORDINALITY AS t(value, ord)
    ORDER BY ord
  LOOP
    v_i := v_i + 1;
    v_min := coalesce((v_tier->>'min_amount')::numeric, 0);
    v_max := NULLIF(v_tier->>'max_amount', '')::numeric;
    v_rate := coalesce((v_tier->>'rate')::numeric, 0);
    v_rate_type := lower(btrim(coalesce(v_tier->>'rate_type', 'percent')));

    IF v_min < 0 THEN RAISE EXCEPTION 'Tier %: min_amount cannot be negative', v_i; END IF;
    IF v_max IS NOT NULL AND v_max < v_min THEN
      RAISE EXCEPTION 'Tier %: max_amount must be >= min_amount', v_i;
    END IF;
    IF v_min < v_prev_min THEN
      RAISE EXCEPTION 'Tier %: tiers must be sorted by ascending min_amount', v_i;
    END IF;
    IF v_rate_type NOT IN ('percent', 'fixed') THEN
      RAISE EXCEPTION 'Tier %: rate_type must be percent or fixed', v_i;
    END IF;
    IF v_rate < 0 THEN RAISE EXCEPTION 'Tier %: rate cannot be negative', v_i; END IF;

    v_prev_min := v_min;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'min_amount', v_min,
      'max_amount', v_max,
      'rate_type', v_rate_type,
      'rate', v_rate
    ));
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public._pick_commission_tier(p_tiers jsonb, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier jsonb;
  v_min numeric;
  v_max numeric;
  v_best jsonb := NULL;
BEGIN
  FOR v_tier IN SELECT value FROM jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb))
  LOOP
    v_min := coalesce((v_tier->>'min_amount')::numeric, 0);
    v_max := NULLIF(v_tier->>'max_amount', '')::numeric;
    IF p_amount >= v_min AND (v_max IS NULL OR p_amount <= v_max) THEN
      v_best := v_tier;
    END IF;
  END LOOP;
  RETURN v_best;
END;
$$;

CREATE OR REPLACE FUNCTION public._calc_tier_commission(
  p_tier jsonb,
  p_sale_total numeric,
  p_profit numeric,
  p_base_metric text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate numeric;
  v_rate_type text;
  v_base numeric;
BEGIN
  IF p_tier IS NULL THEN RETURN 0; END IF;
  v_rate := coalesce((p_tier->>'rate')::numeric, 0);
  v_rate_type := lower(btrim(coalesce(p_tier->>'rate_type', 'percent')));
  v_base := CASE
    WHEN p_base_metric = 'profit' THEN GREATEST(p_profit, 0)
    ELSE p_sale_total
  END;

  IF v_rate_type = 'fixed' THEN
    RETURN round(v_rate, 2);
  END IF;
  RETURN round(v_base * (v_rate / 100.0), 2);
END;
$$;

--------------------------------------------------------------------------------
-- Search subjects (employees + moderator/tele profiles)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_commission_subjects(
  p_query text DEFAULT NULL,
  p_kind text DEFAULT 'all',
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
  v_q text := NULLIF(btrim(p_query), '');
  v_kind text := lower(coalesce(NULLIF(btrim(p_kind), ''), 'all'));
  v_employees jsonb := '[]'::jsonb;
  v_profiles jsonb := '[]'::jsonb;
BEGIN
  IF NOT (
    public.user_has_permission('sales.commission.read')
    OR public.user_has_permission('sales.commission.manage')
    OR public.user_has_permission('pos.create')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  IF v_kind NOT IN ('all', 'employee', 'profile') THEN
    RAISE EXCEPTION 'kind must be all, employee, or profile';
  END IF;

  IF v_kind IN ('all', 'employee') THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.label), '[]'::jsonb)
    INTO v_employees
    FROM (
      SELECT
        e.id::text AS id,
        'employee'::text AS kind,
        (e.full_name || ' (' || e.employee_code || ')')::text AS label,
        concat_ws(' · ', nullif(e.designation, ''), b.name)::text AS description,
        e.profile_id::text AS profile_id
      FROM public.employees e
      LEFT JOIN public.branches b ON b.id = e.branch_id
      WHERE e.organization_id = v_org
        AND e.deleted_at IS NULL
        AND e.status = 'active'
        AND (p_branch_id IS NULL OR e.branch_id IS NULL OR e.branch_id = p_branch_id)
        AND (
          v_q IS NULL
          OR e.full_name ILIKE '%' || v_q || '%'
          OR e.employee_code ILIKE '%' || v_q || '%'
          OR coalesce(e.phone, '') ILIKE '%' || v_q || '%'
        )
      ORDER BY e.full_name
      LIMIT 30
    ) t;
  END IF;

  IF v_kind IN ('all', 'profile') THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.label), '[]'::jsonb)
    INTO v_profiles
    FROM (
      SELECT DISTINCT ON (p.id)
        p.id::text AS id,
        'profile'::text AS kind,
        p.full_name::text AS label,
        coalesce(r.name, p.email, '')::text AS description,
        p.id::text AS profile_id
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id AND r.deleted_at IS NULL
      WHERE p.organization_id = v_org
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND (
          r.name ILIKE 'Moderator%'
          OR r.name ILIKE 'Tele Sales%'
          OR EXISTS (
            SELECT 1
            FROM public.role_permissions rp
            JOIN public.permissions perm ON perm.id = rp.permission_id AND perm.deleted_at IS NULL
            WHERE rp.role_id = r.id
              AND rp.deleted_at IS NULL
              AND (
                perm.key LIKE 'moderator.%'
                OR perm.key LIKE 'tele_sales.%'
              )
          )
        )
        AND (
          v_q IS NULL
          OR p.full_name ILIKE '%' || v_q || '%'
          OR coalesce(p.email, '') ILIKE '%' || v_q || '%'
          OR coalesce(p.phone, '') ILIKE '%' || v_q || '%'
        )
      ORDER BY p.id, p.full_name
      LIMIT 30
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'employees', coalesce(v_employees, '[]'::jsonb),
    'profiles', coalesce(v_profiles, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.search_commission_subjects(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_commission_subjects(text, text, uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Upsert / list with structure fields
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_commission_rule(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_subject_type text;
  v_target_profile uuid;
  v_target_employee uuid;
  v_branch_id uuid;
  v_rule_type text;
  v_rate numeric(14, 4);
  v_structure_mode text;
  v_base_metric text;
  v_tiers jsonb;
  v_period_unit text;
  v_sources text[];
  v_effective_from date;
  v_notes text;
  v_existing public.salesman_commission_rules%ROWTYPE;
  v_new_id uuid;
  v_is_active boolean;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.commission.manage') THEN
    RAISE EXCEPTION 'Missing permission sales.commission.manage' USING ERRCODE = '42501';
  END IF;

  v_subject_type := lower(btrim(coalesce(payload->>'subject_type',
    CASE WHEN NULLIF(payload->>'employee_id', '') IS NOT NULL THEN 'employee' ELSE 'profile' END
  )));
  v_target_employee := NULLIF(payload->>'employee_id', '')::uuid;
  v_target_profile := NULLIF(payload->>'profile_id', '')::uuid;
  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_rule_type := lower(btrim(coalesce(payload->>'rule_type', 'percent_sale')));
  v_rate := coalesce((payload->>'rate')::numeric, 0);
  v_structure_mode := lower(btrim(coalesce(payload->>'structure_mode', 'per_sale')));
  v_base_metric := lower(btrim(coalesce(payload->>'base_metric', 'sale_total')));
  v_period_unit := lower(btrim(coalesce(payload->>'period_unit', 'month')));
  v_effective_from := coalesce((payload->>'effective_from')::date, (timezone('utc', now()))::date);
  v_notes := NULLIF(payload->>'notes', '');

  IF payload ? 'applies_to_sources' AND jsonb_typeof(payload->'applies_to_sources') = 'array' THEN
    SELECT array_agg(x)
    INTO v_sources
    FROM jsonb_array_elements_text(payload->'applies_to_sources') AS t(x);
  ELSE
    v_sources := ARRAY['pos', 'moderator', 'tele_sales', 'ecommerce', 'manual', 'other']::text[];
  END IF;

  IF v_subject_type = 'employee' THEN
    IF v_target_employee IS NULL THEN RAISE EXCEPTION 'employee_id is required'; END IF;
    SELECT e.profile_id INTO v_target_profile
    FROM public.employees e
    WHERE e.id = v_target_employee
      AND e.organization_id = v_org_id
      AND e.deleted_at IS NULL
      AND e.status <> 'terminated';
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid employee'; END IF;

    UPDATE public.employees
    SET commission_eligible = true, updated_at = timezone('utc', now())
    WHERE id = v_target_employee;
  ELSIF v_subject_type = 'profile' THEN
    IF v_target_profile IS NULL THEN RAISE EXCEPTION 'profile_id is required'; END IF;
    v_target_employee := NULL;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_target_profile AND p.organization_id = v_org_id AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid profile';
    END IF;
  ELSE
    RAISE EXCEPTION 'subject_type must be employee or profile';
  END IF;

  IF v_structure_mode NOT IN ('per_sale', 'sale_amount_tiers', 'period_volume_tiers') THEN
    RAISE EXCEPTION 'Invalid structure_mode';
  END IF;
  IF v_base_metric NOT IN ('sale_total', 'profit') THEN
    RAISE EXCEPTION 'Invalid base_metric';
  END IF;
  IF v_period_unit <> 'month' THEN
    RAISE EXCEPTION 'period_unit must be month';
  END IF;

  IF v_structure_mode = 'per_sale' THEN
    IF v_rule_type NOT IN ('fixed', 'percent_sale', 'percent_profit', 'none') THEN
      RAISE EXCEPTION 'Invalid rule_type';
    END IF;
    IF v_rate < 0 THEN RAISE EXCEPTION 'rate cannot be negative'; END IF;
    v_tiers := '[]'::jsonb;
    v_is_active := v_rule_type <> 'none';
  ELSE
    v_tiers := public._validate_commission_tiers(coalesce(payload->'tiers', '[]'::jsonb));
    IF jsonb_array_length(v_tiers) < 1 THEN
      RAISE EXCEPTION 'At least one tier is required';
    END IF;
    v_rule_type := 'percent_sale';
    v_rate := 0;
    v_is_active := true;
  END IF;

  IF v_branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = v_org_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND (r.branch_id IS NOT DISTINCT FROM v_branch_id)
    AND (
      (v_subject_type = 'employee' AND r.employee_id = v_target_employee)
      OR (v_subject_type = 'profile' AND r.profile_id = v_target_profile AND r.subject_type = 'profile')
    )
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.effective_from >= v_effective_from THEN
      RAISE EXCEPTION 'New rule effective_from must be after the current active rule';
    END IF;
    UPDATE public.salesman_commission_rules
    SET is_active = false,
        effective_to = v_effective_from - 1,
        updated_by = v_profile_id
    WHERE id = v_existing.id;
  END IF;

  INSERT INTO public.salesman_commission_rules (
    organization_id, branch_id, profile_id, employee_id, subject_type,
    rule_type, rate, structure_mode, base_metric, tiers, period_unit, applies_to_sources,
    is_active, effective_from, notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_target_profile, v_target_employee, v_subject_type,
    v_rule_type, v_rate, v_structure_mode, v_base_metric, v_tiers, v_period_unit, v_sources,
    v_is_active, v_effective_from, v_notes, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_new_id;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'commission.rule.upsert', 'salesman_commission_rule', v_new_id,
    CASE WHEN v_existing.id IS NULL THEN NULL ELSE to_jsonb(v_existing) END,
    jsonb_build_object(
      'subject_type', v_subject_type,
      'structure_mode', v_structure_mode,
      'rule_type', v_rule_type,
      'rate', v_rate,
      'tiers', v_tiers,
      'employee_id', v_target_employee,
      'profile_id', v_target_profile
    ),
    NULL,
    jsonb_build_object('source', 'upsert_commission_rule')
  );

  RETURN jsonb_build_object(
    'rule_id', v_new_id,
    'profile_id', v_target_profile,
    'employee_id', v_target_employee,
    'subject_type', v_subject_type,
    'structure_mode', v_structure_mode
  );
END;
$$;

--------------------------------------------------------------------------------
-- Accrual engine with structures + moderator/tele attribution
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._accrue_sale_commission(p_sale_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_rule public.salesman_commission_rules%ROWTYPE;
  v_cogs numeric(14, 2) := 0;
  v_amount numeric(14, 2) := 0;
  v_commission_id uuid;
  v_key text;
  v_sale_date date;
  v_employee_id uuid;
  v_profile_id uuid;
  v_source text;
  v_now timestamptz := timezone('utc', now());
  v_period_start date;
  v_period_end date;
  v_volume numeric(14, 2) := 0;
  v_tier jsonb;
  v_band_amount numeric(14, 2);
  v_profit numeric(14, 2);
BEGIN
  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.deleted_at IS NULL;

  IF NOT FOUND OR v_sale.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  v_employee_id := v_sale.salesperson_employee_id;
  v_profile_id := coalesce(
    v_sale.salesperson_id,
    v_sale.moderator_id,
    v_sale.tele_salesman_id
  );
  v_source := coalesce(nullif(v_sale.order_source, ''), 'pos');

  IF v_employee_id IS NULL AND v_profile_id IS NOT NULL THEN
    SELECT e.id INTO v_employee_id
    FROM public.employees e
    WHERE e.profile_id = v_profile_id
      AND e.organization_id = v_sale.organization_id
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

  IF v_employee_id IS NULL AND v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_sale_date := coalesce(v_sale.completed_at, v_sale.created_at)::date;
  v_key := 'sale-comm:' || p_sale_id::text;

  IF EXISTS (
    SELECT 1 FROM public.salesman_commissions sc
    WHERE sc.organization_id = v_sale.organization_id
      AND sc.client_txn_key = v_key
      AND sc.deleted_at IS NULL
  ) THEN
    SELECT id INTO v_commission_id
    FROM public.salesman_commissions
    WHERE organization_id = v_sale.organization_id
      AND client_txn_key = v_key AND deleted_at IS NULL
    LIMIT 1;
    RETURN v_commission_id;
  END IF;

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

  SELECT COALESCE(sum(round(si.qty * si.cost_price, 2)), 0) INTO v_cogs
  FROM public.sale_items si
  WHERE si.sale_id = p_sale_id AND si.deleted_at IS NULL;

  v_profit := GREATEST(v_sale.grand_total - v_cogs, 0);

  IF v_rule.structure_mode = 'per_sale' THEN
    v_amount := CASE v_rule.rule_type
      WHEN 'fixed' THEN v_rule.rate
      WHEN 'percent_sale' THEN round(v_sale.grand_total * (v_rule.rate / 100.0), 2)
      WHEN 'percent_profit' THEN round(v_profit * (v_rule.rate / 100.0), 2)
      ELSE 0
    END;
  ELSIF v_rule.structure_mode = 'sale_amount_tiers' THEN
    v_band_amount := v_sale.grand_total;
    v_tier := public._pick_commission_tier(v_rule.tiers, v_band_amount);
    v_amount := public._calc_tier_commission(v_tier, v_sale.grand_total, v_profit, v_rule.base_metric);
  ELSE
    -- period_volume_tiers: calendar month volume for subject, then apply tier to this sale
    v_period_start := date_trunc('month', v_sale_date)::date;
    v_period_end := (date_trunc('month', v_sale_date) + interval '1 month - 1 day')::date;

    SELECT coalesce(sum(s.grand_total), 0) INTO v_volume
    FROM public.sales s
    WHERE s.organization_id = v_sale.organization_id
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND coalesce(s.completed_at, s.created_at)::date BETWEEN v_period_start AND v_period_end
      AND (
        (v_employee_id IS NOT NULL AND s.salesperson_employee_id = v_employee_id)
        OR (
          v_profile_id IS NOT NULL AND (
            s.salesperson_id = v_profile_id
            OR s.moderator_id = v_profile_id
            OR s.tele_salesman_id = v_profile_id
          )
        )
      );

    v_tier := public._pick_commission_tier(v_rule.tiers, v_volume);
    v_amount := public._calc_tier_commission(v_tier, v_sale.grand_total, v_profit, v_rule.base_metric);
  END IF;

  IF v_amount <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.salesman_commissions (
    organization_id, branch_id, profile_id, employee_id, sale_id,
    base_amount, cogs_amount, commission_amount, status,
    approved_at, approved_by,
    client_txn_key, rule_snapshot, needs_employee_link, created_by, updated_by
  ) VALUES (
    v_sale.organization_id, v_sale.branch_id, v_profile_id, v_employee_id, p_sale_id,
    v_sale.grand_total, v_cogs, v_amount, 'approved',
    v_now, v_sale.created_by,
    v_key,
    jsonb_build_object(
      'rule_id', v_rule.id,
      'subject_type', v_rule.subject_type,
      'structure_mode', v_rule.structure_mode,
      'rule_type', v_rule.rule_type,
      'rate', v_rule.rate,
      'base_metric', v_rule.base_metric,
      'tiers', v_rule.tiers,
      'matched_tier', v_tier,
      'period_volume', CASE WHEN v_rule.structure_mode = 'period_volume_tiers' THEN v_volume ELSE NULL END,
      'order_source', v_source,
      'effective_from', v_rule.effective_from,
      'employee_id', v_rule.employee_id,
      'profile_id', v_rule.profile_id
    ),
    (v_employee_id IS NULL AND v_profile_id IS NOT NULL),
    v_sale.created_by, v_sale.created_by
  )
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_sale_commission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_sale_commission(uuid) TO service_role;

--------------------------------------------------------------------------------
-- Trigger: accrue whenever a sale becomes completed (covers POS + online fulfil)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sales_completed_accrue_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public._accrue_sale_commission(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_completed_accrue_commission ON public.sales;
CREATE TRIGGER sales_completed_accrue_commission
  AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sales_completed_accrue_commission();
