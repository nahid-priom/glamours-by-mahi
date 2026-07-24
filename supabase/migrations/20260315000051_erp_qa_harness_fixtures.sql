-- Fix QA harness: create courier company fixture when seed data is absent

CREATE OR REPLACE FUNCTION public.run_erp_qa_cod_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_branch uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_company uuid;
  v_parcel_id uuid;
  v_jcount int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('scenario', 7, 'status', 'SKIP', 'reason', 'seed_org_missing');
  END IF;

  SELECT id INTO v_company
  FROM public.courier_companies
  WHERE organization_id = v_org AND deleted_at IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_company IS NULL THEN
    INSERT INTO public.courier_companies (
      organization_id, name, code, status, connection_status
    ) VALUES (
      v_org, 'QA-ERP Courier', 'QA-ERP-CC', 'active', 'disconnected'
    )
    RETURNING id INTO v_company;
  END IF;

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge,
    customer_name, customer_phone
  ) VALUES (
    v_org, v_branch, v_company,
    'QA-ERP-COD-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 1500.00, 50.00,
    'QA Customer', '01700000000'
  )
  RETURNING id INTO v_parcel_id;

  PERFORM set_config('app.allow_parcel_status', '1', true);
  UPDATE public.courier_parcels
  SET status = 'delivered', delivered_at = timezone('utc', now())
  WHERE id = v_parcel_id;

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.organization_id = v_org
    AND je.source_type = 'courier_cod'
    AND je.source_id = v_parcel_id
    AND je.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'COD journal must be posted exactly once on delivery');

  PERFORM set_config('app.allow_parcel_status', '1', true);
  UPDATE public.courier_parcels SET status = 'delivered' WHERE id = v_parcel_id;

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.organization_id = v_org
    AND je.source_type = 'courier_cod'
    AND je.source_id = v_parcel_id
    AND je.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'duplicate delivered must not duplicate COD journal');

  SELECT count(*) INTO v_jcount
  FROM public.courier_settlements cs
  WHERE cs.parcel_id = v_parcel_id AND cs.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'settlement row must exist for COD parcel');

  UPDATE public.courier_parcels SET deleted_at = timezone('utc', now()) WHERE id = v_parcel_id;

  RETURN jsonb_build_object(
    'scenario', 7,
    'parcel_id', v_parcel_id,
    'status', 'PASS'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.run_erp_qa_non_cod_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_branch uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_company uuid;
  v_parcel_id uuid;
  v_jcount int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('scenario', '7b', 'status', 'SKIP', 'reason', 'seed_org_missing');
  END IF;

  SELECT id INTO v_company
  FROM public.courier_companies
  WHERE organization_id = v_org AND deleted_at IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_company IS NULL THEN
    INSERT INTO public.courier_companies (
      organization_id, name, code, status, connection_status
    ) VALUES (
      v_org, 'QA-ERP Courier', 'QA-ERP-CC', 'active', 'disconnected'
    )
    RETURNING id INTO v_company;
  END IF;

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge
  ) VALUES (
    v_org, v_branch, v_company,
    'QA-ERP-NOCOD-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 0, 30.00
  )
  RETURNING id INTO v_parcel_id;

  PERFORM set_config('app.allow_parcel_status', '1', true);
  UPDATE public.courier_parcels SET status = 'delivered' WHERE id = v_parcel_id;

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.source_type = 'courier_cod' AND je.source_id = v_parcel_id;

  PERFORM public._erp_assert(v_jcount = 0, 'non-COD parcel must not post courier receivable');

  UPDATE public.courier_parcels SET deleted_at = timezone('utc', now()) WHERE id = v_parcel_id;

  RETURN jsonb_build_object('scenario', '7b', 'parcel_id', v_parcel_id, 'status', 'PASS');
END;
$$;
