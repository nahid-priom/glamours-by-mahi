-- Generic bulk CSV import jobs + lookup helpers (products / customers / suppliers)

--------------------------------------------------------------------------------
-- Permissions
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('customers.import', 'Import customers from CSV'),
  ('suppliers.import', 'Import suppliers from CSV')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = v.key AND p.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Owner', 'Super Admin')
  AND r.deleted_at IS NULL
  AND p.key IN ('customers.import', 'suppliers.import')
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Tables
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  entity_type text NOT NULL,
  mode text NOT NULL DEFAULT 'create_or_update',
  status text NOT NULL DEFAULT 'draft',
  filename text,
  total_rows int NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz,
  CONSTRAINT import_jobs_entity_type_chk CHECK (entity_type IN ('products', 'customers', 'suppliers')),
  CONSTRAINT import_jobs_mode_chk CHECK (
    mode IN ('create_new', 'create_or_update', 'update_only', 'skip_duplicates')
  ),
  CONSTRAINT import_jobs_status_chk CHECK (
    status IN ('draft', 'ready', 'running', 'completed', 'failed', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS public.import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  row_num int NOT NULL,
  action text NOT NULL DEFAULT 'create',
  match_key text,
  existing_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT import_job_rows_action_chk CHECK (action IN ('create', 'update', 'skip', 'error')),
  CONSTRAINT import_job_rows_status_chk CHECK (
    status IN ('pending', 'invalid', 'success', 'failed', 'skipped')
  ),
  CONSTRAINT import_job_rows_job_row_uidx UNIQUE (job_id, row_num)
);

CREATE INDEX IF NOT EXISTS import_jobs_org_created_idx
  ON public.import_jobs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS import_job_rows_job_status_idx
  ON public.import_job_rows (job_id, status);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._import_entity_permission(p_entity text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_entity
    WHEN 'products' THEN 'products.import'
    WHEN 'customers' THEN 'customers.import'
    WHEN 'suppliers' THEN 'suppliers.import'
    ELSE 'products.import'
  END;
$$;

DROP POLICY IF EXISTS import_jobs_all ON public.import_jobs;
CREATE POLICY import_jobs_all ON public.import_jobs
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission(public._import_entity_permission(entity_type))
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission(public._import_entity_permission(entity_type))
  );

DROP POLICY IF EXISTS import_job_rows_all ON public.import_job_rows;
CREATE POLICY import_job_rows_all ON public.import_job_rows
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.import_jobs j
      WHERE j.id = import_job_rows.job_id
        AND public.user_has_permission(public._import_entity_permission(j.entity_type))
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.import_jobs j
      WHERE j.id = import_job_rows.job_id
        AND public.user_has_permission(public._import_entity_permission(j.entity_type))
    )
  );

--------------------------------------------------------------------------------
-- Lookup RPCs
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_products_for_import(
  p_skus text[] DEFAULT '{}',
  p_barcodes text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.user_has_permission('products.import')
    OR public.user_has_permission('products.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission products.import' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'match_key', coalesce(nullif(p.base_sku, ''), p.base_barcode),
      'snapshot', jsonb_build_object(
        'name', p.name,
        'sku', p.base_sku,
        'barcode', p.base_barcode,
        'purchase_price', p.purchase_price,
        'selling_price', p.selling_price,
        'status', p.status,
        'category_id', p.category_id,
        'brand_id', p.brand_id
      )
    ))
    FROM public.products p
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND (
        (cardinality(p_skus) > 0 AND p.base_sku = ANY (p_skus))
        OR (cardinality(p_barcodes) > 0 AND p.base_barcode = ANY (p_barcodes))
      )
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_customers_for_import(
  p_phones text[] DEFAULT '{}',
  p_barcodes text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.user_has_permission('customers.import')
    OR public.user_has_permission('customers.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission customers.import' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'match_key', coalesce(c.phone, c.barcode),
      'snapshot', jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'email', c.email,
        'address', c.address,
        'district', c.district,
        'barcode', c.barcode,
        'preferred_channel', c.preferred_channel,
        'notes', c.notes,
        'status', c.status
      )
    ))
    FROM public.customers c
    WHERE c.organization_id = v_org
      AND c.deleted_at IS NULL
      AND (
        (cardinality(p_phones) > 0 AND c.phone = ANY (p_phones))
        OR (cardinality(p_barcodes) > 0 AND c.barcode = ANY (p_barcodes))
      )
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_suppliers_for_import(
  p_names text[] DEFAULT '{}',
  p_barcodes text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.user_has_permission('suppliers.import')
    OR public.user_has_permission('suppliers.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission suppliers.import' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'match_key', lower(s.name),
      'snapshot', jsonb_build_object(
        'name', s.name,
        'phone', s.phone,
        'email', s.email,
        'address', s.address,
        'barcode', s.barcode,
        'notes', s.notes,
        'status', s.status
      )
    ))
    FROM public.suppliers s
    WHERE s.organization_id = v_org
      AND s.deleted_at IS NULL
      AND (
        (cardinality(p_names) > 0 AND lower(s.name) = ANY (
          SELECT lower(x) FROM unnest(p_names) AS x
        ))
        OR (cardinality(p_barcodes) > 0 AND s.barcode = ANY (p_barcodes))
      )
  ), '[]'::jsonb);
END;
$$;

--------------------------------------------------------------------------------
-- Job lifecycle RPCs
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_import_job(
  p_entity_type text,
  p_filename text DEFAULT NULL,
  p_mode text DEFAULT 'create_or_update',
  p_total_rows int DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_id uuid;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_entity_type NOT IN ('products', 'customers', 'suppliers') THEN
    RAISE EXCEPTION 'Invalid entity_type';
  END IF;
  IF NOT public.user_has_permission(public._import_entity_permission(p_entity_type)) THEN
    RAISE EXCEPTION 'Missing import permission' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.import_jobs (
    organization_id, entity_type, mode, status, filename, total_rows, created_by
  ) VALUES (
    v_org, p_entity_type, coalesce(nullif(p_mode, ''), 'create_or_update'),
    'ready', p_filename, coalesce(p_total_rows, 0), v_actor
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_import_job_rows(
  p_job_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_entity text;
  v_row jsonb;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT entity_type INTO v_entity
  FROM public.import_jobs
  WHERE id = p_job_id AND organization_id = v_org;

  IF v_entity IS NULL THEN RAISE EXCEPTION 'Import job not found'; END IF;
  IF NOT public.user_has_permission(public._import_entity_permission(v_entity)) THEN
    RAISE EXCEPTION 'Missing import permission' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  LOOP
    INSERT INTO public.import_job_rows (
      job_id, organization_id, row_num, action, match_key, existing_id, payload, errors, status
    ) VALUES (
      p_job_id,
      v_org,
      (v_row->>'row_num')::int,
      coalesce(v_row->>'action', 'create'),
      v_row->>'match_key',
      nullif(v_row->>'existing_id', '')::uuid,
      coalesce(v_row->'payload', '{}'::jsonb),
      coalesce(
        ARRAY(SELECT jsonb_array_elements_text(coalesce(v_row->'errors', '[]'::jsonb))),
        '{}'::text[]
      ),
      coalesce(v_row->>'status', 'pending')
    )
    ON CONFLICT (job_id, row_num) DO UPDATE SET
      action = EXCLUDED.action,
      match_key = EXCLUDED.match_key,
      existing_id = EXCLUDED.existing_id,
      payload = EXCLUDED.payload,
      errors = EXCLUDED.errors,
      status = EXCLUDED.status,
      updated_at = timezone('utc', now());
  END LOOP;

  UPDATE public.import_jobs
  SET total_rows = jsonb_array_length(coalesce(p_rows, '[]'::jsonb)),
      status = 'ready',
      updated_at = timezone('utc', now())
  WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_import_job_row(
  p_job_id uuid,
  p_row_num int,
  p_status text,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.import_jobs
  SET status = 'running', updated_at = timezone('utc', now())
  WHERE id = p_job_id AND organization_id = v_org AND status IN ('ready', 'running', 'draft');

  UPDATE public.import_job_rows
  SET status = p_status,
      result = coalesce(p_result, '{}'::jsonb),
      errors = CASE
        WHEN p_error IS NOT NULL THEN array_append(coalesce(errors, '{}'::text[]), p_error)
        ELSE errors
      END,
      updated_at = timezone('utc', now())
  WHERE job_id = p_job_id
    AND organization_id = v_org
    AND row_num = p_row_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_import_job(
  p_job_id uuid,
  p_summary jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'completed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.import_jobs
  SET status = coalesce(nullif(p_status, ''), 'completed'),
      summary = coalesce(p_summary, '{}'::jsonb),
      completed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = p_job_id AND organization_id = v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_products_for_import(text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_customers_for_import(text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_suppliers_for_import(text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_import_job(text, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_import_job_rows(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_import_job_row(uuid, int, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_import_job(uuid, jsonb, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lookup_products_for_import(text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_customers_for_import(text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_suppliers_for_import(text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_import_job(text, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_import_job_rows(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_import_job_row(uuid, int, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_import_job(uuid, jsonb, text) TO authenticated;
