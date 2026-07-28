-- Migration 072: Fan out opening stock to all variants when variant_id is omitted

CREATE OR REPLACE FUNCTION public.create_product_with_variants(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_product_id uuid;
  v_status text;
  v_has_variants boolean;
  v_opt jsonb;
  v_opt_id uuid;
  v_val jsonb;
  v_val_id uuid;
  v_size_opt_id uuid;
  v_color_opt_id uuid;
  v_size_map jsonb := '{}'::jsonb;
  v_color_map jsonb := '{}'::jsonb;
  v_variant jsonb;
  v_variant_id uuid;
  v_image jsonb;
  v_branch_price jsonb;
  v_opening jsonb;
  v_created_variants jsonb := '[]'::jsonb;
  v_sku text;
  v_i int := 0;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_org_id := public.current_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization'; END IF;
  IF NOT public.user_has_permission('products.create') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NULLIF(trim(payload->>'name'), '') IS NULL THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;

  v_status := COALESCE(NULLIF(payload->>'status', ''), 'draft');
  IF v_status NOT IN ('draft', 'pending_approval', 'approved', 'active', 'inactive') THEN
    v_status := 'draft';
  END IF;

  v_has_variants := COALESCE((payload->>'has_variants')::boolean, false);

  IF v_has_variants AND jsonb_array_length(COALESCE(payload->'variants', '[]'::jsonb)) < 1 THEN
    RAISE EXCEPTION 'Variable products require at least one variant';
  END IF;

  IF v_status = 'active' THEN
    IF NULLIF(payload->>'category_id', '') IS NULL THEN
      RAISE EXCEPTION 'Category required to activate product';
    END IF;
    IF COALESCE((payload->>'selling_price')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'Invalid selling price';
    END IF;
  END IF;

  INSERT INTO public.products (
    organization_id, name, description, category_id, subcategory_id, brand_id,
    product_type, unit, base_sku, base_barcode,
    purchase_price, selling_price, wholesale_price, reorder_level, tax_rate,
    is_active, track_inventory, has_variants, status, published_at,
    batch_tracking_enabled, expiry_tracking_enabled, allocation_strategy,
    ingredients, skin_type, gender_target, country_of_origin, manufacturer,
    importer, regulatory_notes, default_expiry_alert_days, tags,
    approved_at, approved_by, created_by, updated_by
  ) VALUES (
    v_org_id,
    trim(payload->>'name'),
    NULLIF(payload->>'description', ''),
    NULLIF(payload->>'category_id', '')::uuid,
    NULLIF(payload->>'subcategory_id', '')::uuid,
    NULLIF(payload->>'brand_id', '')::uuid,
    COALESCE(NULLIF(payload->>'product_type', ''), CASE WHEN v_has_variants THEN 'variable' ELSE 'simple' END),
    COALESCE(NULLIF(payload->>'unit', ''), 'pcs'),
    NULLIF(payload->>'base_sku', ''),
    NULLIF(payload->>'base_barcode', ''),
    COALESCE((payload->>'purchase_price')::numeric, 0),
    COALESCE((payload->>'selling_price')::numeric, 0),
    NULLIF(payload->>'wholesale_price', '')::numeric,
    COALESCE((payload->>'reorder_level')::numeric, 0),
    COALESCE((payload->>'tax_rate')::numeric, 0),
    (v_status = 'active'),
    COALESCE((payload->>'track_inventory')::boolean, true),
    v_has_variants,
    v_status,
    CASE WHEN v_status = 'active' AND COALESCE((payload->>'publish')::boolean, false)
      THEN timezone('utc', now()) ELSE NULL END,
    COALESCE((payload->>'batch_tracking_enabled')::boolean, false),
    COALESCE((payload->>'expiry_tracking_enabled')::boolean, false),
    COALESCE(NULLIF(payload->>'allocation_strategy', ''), 'fifo'),
    NULLIF(payload->>'ingredients', ''),
    NULLIF(payload->>'skin_type', ''),
    NULLIF(payload->>'gender_target', ''),
    NULLIF(payload->>'country_of_origin', ''),
    NULLIF(payload->>'manufacturer', ''),
    NULLIF(payload->>'importer', ''),
    NULLIF(payload->>'regulatory_notes', ''),
    COALESCE((payload->>'default_expiry_alert_days')::integer, 30),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'tags', '[]'::jsonb))),
      '{}'::text[]
    ),
    CASE WHEN v_status IN ('approved', 'active') THEN timezone('utc', now()) ELSE NULL END,
    CASE WHEN v_status IN ('approved', 'active') THEN v_actor ELSE NULL END,
    v_actor, v_actor
  )
  RETURNING id INTO v_product_id;

  FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'options', '[]'::jsonb))
  LOOP
    INSERT INTO public.product_options (organization_id, product_id, name, sort_order, created_by)
    VALUES (
      v_org_id, v_product_id,
      v_opt->>'name',
      COALESCE((v_opt->>'sort_order')::int, 0),
      v_actor
    )
    RETURNING id INTO v_opt_id;

    IF lower(v_opt->>'name') IN ('size', 'volume') THEN
      v_size_opt_id := v_opt_id;
    ELSIF lower(v_opt->>'name') IN ('color', 'shade') THEN
      v_color_opt_id := v_opt_id;
    END IF;

    FOR v_val IN SELECT * FROM jsonb_array_elements(COALESCE(v_opt->'values', '[]'::jsonb))
    LOOP
      INSERT INTO public.product_option_values (organization_id, option_id, value, sort_order, created_by)
      VALUES (
        v_org_id, v_opt_id,
        COALESCE(v_val->>'value', v_val#>>'{}'),
        COALESCE((v_val->>'sort_order')::int, 0),
        v_actor
      )
      RETURNING id INTO v_val_id;

      IF v_opt_id = v_size_opt_id THEN
        v_size_map := v_size_map || jsonb_build_object(COALESCE(v_val->>'value', v_val#>>'{}'), v_val_id);
      ELSIF v_opt_id = v_color_opt_id THEN
        v_color_map := v_color_map || jsonb_build_object(COALESCE(v_val->>'value', v_val#>>'{}'), v_val_id);
      END IF;
    END LOOP;
  END LOOP;

  IF v_has_variants THEN
    FOR v_variant IN SELECT * FROM jsonb_array_elements(payload->'variants')
    LOOP
      v_i := v_i + 1;
      v_sku := COALESCE(NULLIF(trim(v_variant->>'sku'), ''), format('SKU-%s-%s', left(v_product_id::text, 8), lpad(v_i::text, 3, '0')));

      INSERT INTO public.product_variants (
        organization_id, product_id, sku, barcode, name,
        purchase_price, selling_price, wholesale_price, image_path, is_active, created_by
      ) VALUES (
        v_org_id, v_product_id, v_sku,
        NULLIF(v_variant->>'barcode', ''),
        COALESCE(NULLIF(v_variant->>'name', ''), v_sku),
        COALESCE((v_variant->>'purchase_price')::numeric, (payload->>'purchase_price')::numeric, 0),
        COALESCE((v_variant->>'selling_price')::numeric, (payload->>'selling_price')::numeric, 0),
        NULLIF(v_variant->>'wholesale_price', '')::numeric,
        NULLIF(v_variant->>'image_path', ''),
        COALESCE((v_variant->>'is_active')::boolean, true),
        v_actor
      )
      RETURNING id INTO v_variant_id;

      IF v_size_opt_id IS NOT NULL AND NULLIF(v_variant->>'size', '') IS NOT NULL THEN
        INSERT INTO public.variant_option_values (organization_id, variant_id, option_id, option_value_id, created_by)
        VALUES (
          v_org_id, v_variant_id, v_size_opt_id,
          (v_size_map->> (v_variant->>'size'))::uuid,
          v_actor
        );
      END IF;

      IF v_color_opt_id IS NOT NULL AND NULLIF(v_variant->>'color', '') IS NOT NULL THEN
        INSERT INTO public.variant_option_values (organization_id, variant_id, option_id, option_value_id, created_by)
        VALUES (
          v_org_id, v_variant_id, v_color_opt_id,
          (v_color_map->> (v_variant->>'color'))::uuid,
          v_actor
        );
      END IF;

      v_created_variants := v_created_variants || jsonb_build_array(
        jsonb_build_object('id', v_variant_id, 'sku', v_sku, 'key', v_variant->>'key')
      );
    END LOOP;
  ELSE
    v_sku := COALESCE(NULLIF(trim(payload->>'base_sku'), ''), 'SKU-' || upper(left(v_product_id::text, 8)));
    INSERT INTO public.product_variants (
      organization_id, product_id, sku, barcode, name,
      purchase_price, selling_price, wholesale_price, is_active, created_by
    ) VALUES (
      v_org_id, v_product_id, v_sku,
      NULLIF(payload->>'base_barcode', ''),
      'Default',
      COALESCE((payload->>'purchase_price')::numeric, 0),
      COALESCE((payload->>'selling_price')::numeric, 0),
      NULLIF(payload->>'wholesale_price', '')::numeric,
      true, v_actor
    )
    RETURNING id INTO v_variant_id;

    v_created_variants := jsonb_build_array(
      jsonb_build_object('id', v_variant_id, 'sku', v_sku, 'key', 'default')
    );
  END IF;

  FOR v_image IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'images', '[]'::jsonb))
  LOOP
    INSERT INTO public.product_images (
      organization_id, product_id, variant_id, storage_path, is_cover, sort_order, metadata, created_by
    ) VALUES (
      v_org_id, v_product_id,
      NULLIF(v_image->>'variant_id', '')::uuid,
      v_image->>'storage_path',
      COALESCE((v_image->>'is_cover')::boolean, false),
      COALESCE((v_image->>'sort_order')::int, 0),
      COALESCE(v_image->'metadata', '{}'::jsonb),
      v_actor
    );
  END LOOP;

  FOR v_branch_price IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'branch_prices', '[]'::jsonb))
  LOOP
    INSERT INTO public.branch_product_prices (
      organization_id, branch_id, product_id, variant_id,
      retail_price, wholesale_price, discount_price, created_by
    ) VALUES (
      v_org_id,
      (v_branch_price->>'branch_id')::uuid,
      v_product_id,
      NULLIF(v_branch_price->>'variant_id', '')::uuid,
      NULLIF(v_branch_price->>'retail_price', '')::numeric,
      NULLIF(v_branch_price->>'wholesale_price', '')::numeric,
      NULLIF(v_branch_price->>'discount_price', '')::numeric,
      v_actor
    );
  END LOOP;

  FOR v_opening IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'opening_stock', '[]'::jsonb))
  LOOP
    IF v_has_variants
       AND NULLIF(v_opening->>'variant_id', '') IS NULL
       AND jsonb_array_length(v_created_variants) > 0 THEN
      FOR v_variant IN SELECT * FROM jsonb_array_elements(v_created_variants)
      LOOP
        PERFORM public.create_opening_stock(
          jsonb_build_object(
            'branch_id', v_opening->>'branch_id',
            'location_id', v_opening->>'location_id',
            'variant_id', v_variant->>'id',
            'quantity', v_opening->>'quantity',
            'unit_cost', COALESCE(v_opening->>'unit_cost', payload->>'purchase_price'),
            'batch_number', v_opening->>'batch_number',
            'manufactured_at', v_opening->>'manufactured_at',
            'expires_at', v_opening->>'expires_at',
            'reference', 'product_create'
          )
        );
      END LOOP;
    ELSE
      PERFORM public.create_opening_stock(
        jsonb_build_object(
          'branch_id', v_opening->>'branch_id',
          'location_id', v_opening->>'location_id',
          'variant_id', COALESCE(v_opening->>'variant_id', v_variant_id::text),
          'quantity', v_opening->>'quantity',
          'unit_cost', COALESCE(v_opening->>'unit_cost', payload->>'purchase_price'),
          'batch_number', v_opening->>'batch_number',
          'manufactured_at', v_opening->>'manufactured_at',
          'expires_at', v_opening->>'expires_at',
          'reference', 'product_create'
        )
      );
    END IF;
  END LOOP;

  PERFORM public.write_audit_log(
    v_org_id, NULL, v_actor, 'product.create', 'product', v_product_id,
    NULL,
    jsonb_build_object('status', v_status, 'has_variants', v_has_variants, 'name', payload->>'name')
  );

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'status', v_status,
    'variants', v_created_variants
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_product_with_variants(jsonb) TO authenticated;
