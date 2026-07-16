-- Atomic product creation / update / opening stock / duplicate RPCs

--------------------------------------------------------------------------------
-- create_opening_stock
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_opening_stock(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_branch_id uuid;
  v_location_id uuid;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty numeric(14, 3);
  v_unit_cost numeric(14, 2);
  v_batch_number text;
  v_manufactured date;
  v_expires date;
  v_product public.products%ROWTYPE;
  v_batch_id uuid;
  v_ref text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_org_id := public.current_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization';
  END IF;

  IF NOT (
    public.user_has_permission('inventory.adjust')
    OR public.user_has_permission('products.create')
    OR public.user_has_permission('products.update')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_branch_id := (payload->>'branch_id')::uuid;
  v_location_id := NULLIF(payload->>'location_id', '')::uuid;
  v_variant_id := (payload->>'variant_id')::uuid;
  v_qty := COALESCE((payload->>'quantity')::numeric, 0);
  v_unit_cost := COALESCE((payload->>'unit_cost')::numeric, 0);
  v_batch_number := NULLIF(trim(payload->>'batch_number'), '');
  v_manufactured := NULLIF(payload->>'manufactured_at', '')::date;
  v_expires := NULLIF(payload->>'expires_at', '')::date;
  v_ref := COALESCE(payload->>'reference', 'opening');

  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'Opening stock quantity must be > 0';
  END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access';
  END IF;

  SELECT p.* INTO v_product
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  WHERE pv.id = v_variant_id AND pv.organization_id = v_org_id AND pv.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  v_product_id := v_product.id;

  IF v_location_id IS NULL THEN
    SELECT sl.id INTO v_location_id
    FROM public.stock_locations sl
    WHERE sl.branch_id = v_branch_id
      AND sl.location_type = 'saleable'
      AND sl.is_active = true
      AND sl.deleted_at IS NULL
    ORDER BY sl.is_default DESC NULLS LAST, sl.name
    LIMIT 1;
  END IF;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  IF v_product.batch_tracking_enabled OR v_product.expiry_tracking_enabled THEN
    IF v_batch_number IS NULL THEN
      v_batch_number := 'OPEN-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS');
    END IF;
    IF v_product.expiry_tracking_enabled AND v_expires IS NULL THEN
      RAISE EXCEPTION 'Expiry date required for expiry-tracked products';
    END IF;
    IF v_manufactured IS NOT NULL AND v_expires IS NOT NULL AND v_expires < v_manufactured THEN
      RAISE EXCEPTION 'Expiry date cannot be before manufacturing date';
    END IF;

    INSERT INTO public.inventory_batches (
      organization_id, branch_id, location_id, product_id, variant_id,
      batch_number, manufactured_at, expires_at, quantity_received, quantity_available,
      unit_cost, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_location_id, v_product_id, v_variant_id,
      v_batch_number, v_manufactured, v_expires, v_qty, v_qty,
      v_unit_cost, v_actor, v_actor
    )
    RETURNING id INTO v_batch_id;

    PERFORM public.refresh_batch_status(v_batch_id);
  END IF;

  PERFORM public._adjust_inventory(
    v_org_id, v_branch_id, v_variant_id, v_location_id,
    v_qty, v_unit_cost, 'opening', 'opening_stock', COALESCE(v_batch_id, v_variant_id),
    v_actor, v_ref
  );

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_actor, 'opening_stock.create', 'product_variant', v_variant_id,
    NULL,
    jsonb_build_object(
      'quantity', v_qty,
      'branch_id', v_branch_id,
      'batch_id', v_batch_id,
      'unit_cost', v_unit_cost
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'variant_id', v_variant_id,
    'batch_id', v_batch_id,
    'quantity', v_qty
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_opening_stock(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- create_product_with_variants (atomic)
--------------------------------------------------------------------------------
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

  IF v_status IN ('active', 'approved') AND NOT v_has_variants THEN
    -- ensure default variant will be created
    NULL;
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
      THEN timezone('utc', now()) ELSE NULLIF(payload->>'published_at', '')::timestamptz END,
    COALESCE((payload->>'batch_tracking_enabled')::boolean, false),
    COALESCE((payload->>'expiry_tracking_enabled')::boolean, false),
    COALESCE(NULLIF(payload->>'allocation_strategy', ''), 'fefo'),
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

  -- Options
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

  -- Variants
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

  -- Images (paths already uploaded)
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

  -- Branch prices
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

  -- Opening stock entries
  FOR v_opening IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'opening_stock', '[]'::jsonb))
  LOOP
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

--------------------------------------------------------------------------------
-- duplicate_product
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.duplicate_product(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_source_id uuid;
  v_copy_images boolean;
  v_gen_sku boolean;
  v_gen_barcode boolean;
  v_copy_prices boolean;
  v_src public.products%ROWTYPE;
  v_new_id uuid;
  v_opt record;
  v_new_opt_id uuid;
  v_val record;
  v_opt_map jsonb := '{}'::jsonb;
  v_val_map jsonb := '{}'::jsonb;
  v_var record;
  v_new_var_id uuid;
  v_link record;
  v_img record;
  v_price record;
  v_sku text;
  v_i int := 0;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_org_id := public.current_organization_id();
  IF NOT public.user_has_permission('products.create') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_source_id := (payload->>'product_id')::uuid;
  v_copy_images := COALESCE((payload->>'copy_images')::boolean, true);
  v_gen_sku := COALESCE((payload->>'generate_skus')::boolean, true);
  v_gen_barcode := COALESCE((payload->>'generate_barcodes')::boolean, true);
  v_copy_prices := COALESCE((payload->>'copy_branch_prices')::boolean, false);

  SELECT * INTO v_src FROM public.products
  WHERE id = v_source_id AND organization_id = v_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  INSERT INTO public.products (
    organization_id, name, description, category_id, subcategory_id, brand_id,
    product_type, unit, base_sku, base_barcode,
    purchase_price, selling_price, wholesale_price, reorder_level, tax_rate,
    is_active, track_inventory, has_variants, status,
    batch_tracking_enabled, expiry_tracking_enabled, allocation_strategy,
    ingredients, skin_type, gender_target, country_of_origin, manufacturer,
    importer, regulatory_notes, default_expiry_alert_days, tags,
    created_by, updated_by
  ) VALUES (
    v_org_id,
    COALESCE(NULLIF(payload->>'name', ''), v_src.name || ' - Copy'),
    v_src.description, v_src.category_id, v_src.subcategory_id, v_src.brand_id,
    v_src.product_type, v_src.unit,
    CASE WHEN v_gen_sku THEN NULL ELSE v_src.base_sku END,
    CASE WHEN v_gen_barcode THEN NULL ELSE v_src.base_barcode END,
    v_src.purchase_price, v_src.selling_price, v_src.wholesale_price,
    v_src.reorder_level, v_src.tax_rate,
    false, v_src.track_inventory, v_src.has_variants, 'draft',
    v_src.batch_tracking_enabled, v_src.expiry_tracking_enabled, v_src.allocation_strategy,
    v_src.ingredients, v_src.skin_type, v_src.gender_target, v_src.country_of_origin,
    v_src.manufacturer, v_src.importer, v_src.regulatory_notes,
    v_src.default_expiry_alert_days, v_src.tags,
    v_actor, v_actor
  )
  RETURNING id INTO v_new_id;

  FOR v_opt IN
    SELECT * FROM public.product_options
    WHERE product_id = v_source_id AND deleted_at IS NULL
  LOOP
    INSERT INTO public.product_options (organization_id, product_id, name, sort_order, created_by)
    VALUES (v_org_id, v_new_id, v_opt.name, v_opt.sort_order, v_actor)
    RETURNING id INTO v_new_opt_id;
    v_opt_map := v_opt_map || jsonb_build_object(v_opt.id::text, v_new_opt_id);

    FOR v_val IN
      SELECT * FROM public.product_option_values
      WHERE option_id = v_opt.id AND deleted_at IS NULL
    LOOP
      INSERT INTO public.product_option_values (organization_id, option_id, value, sort_order, created_by)
      VALUES (v_org_id, v_new_opt_id, v_val.value, v_val.sort_order, v_actor);
    END LOOP;
  END LOOP;

  -- Rebuild option value map properly
  FOR v_opt IN
    SELECT o_old.id AS old_id, o_new.id AS new_id
    FROM public.product_options o_old
    JOIN public.product_options o_new
      ON o_new.product_id = v_new_id AND o_new.name = o_old.name AND o_new.deleted_at IS NULL
    WHERE o_old.product_id = v_source_id AND o_old.deleted_at IS NULL
  LOOP
    FOR v_val IN
      SELECT ov_old.id AS old_id, ov_new.id AS new_id
      FROM public.product_option_values ov_old
      JOIN public.product_option_values ov_new
        ON ov_new.option_id = v_opt.new_id AND ov_new.value = ov_old.value AND ov_new.deleted_at IS NULL
      WHERE ov_old.option_id = v_opt.old_id AND ov_old.deleted_at IS NULL
    LOOP
      v_val_map := v_val_map || jsonb_build_object(v_val.old_id::text, v_val.new_id);
    END LOOP;
    v_opt_map := v_opt_map || jsonb_build_object(v_opt.old_id::text, v_opt.new_id);
  END LOOP;

  FOR v_var IN
    SELECT * FROM public.product_variants
    WHERE product_id = v_source_id AND deleted_at IS NULL
  LOOP
    v_i := v_i + 1;
    v_sku := CASE
      WHEN v_gen_sku THEN 'SKU-' || upper(left(v_new_id::text, 6)) || '-' || lpad(v_i::text, 3, '0')
      ELSE v_var.sku || '-COPY'
    END;

    INSERT INTO public.product_variants (
      organization_id, product_id, sku, barcode, name,
      purchase_price, selling_price, wholesale_price, image_path, is_active, created_by
    ) VALUES (
      v_org_id, v_new_id, v_sku,
      CASE WHEN v_gen_barcode THEN NULL ELSE v_var.barcode END,
      v_var.name,
      v_var.purchase_price, v_var.selling_price, v_var.wholesale_price,
      CASE WHEN v_copy_images THEN v_var.image_path ELSE NULL END,
      true, v_actor
    )
    RETURNING id INTO v_new_var_id;

    FOR v_link IN
      SELECT * FROM public.variant_option_values
      WHERE variant_id = v_var.id AND deleted_at IS NULL
    LOOP
      INSERT INTO public.variant_option_values (
        organization_id, variant_id, option_id, option_value_id, created_by
      ) VALUES (
        v_org_id, v_new_var_id,
        (v_opt_map->>v_link.option_id::text)::uuid,
        (v_val_map->>v_link.option_value_id::text)::uuid,
        v_actor
      );
    END LOOP;
  END LOOP;

  IF v_copy_images THEN
    FOR v_img IN
      SELECT * FROM public.product_images
      WHERE product_id = v_source_id AND deleted_at IS NULL AND variant_id IS NULL
    LOOP
      INSERT INTO public.product_images (
        organization_id, product_id, storage_path, is_cover, sort_order, metadata, created_by
      ) VALUES (
        v_org_id, v_new_id, v_img.storage_path, v_img.is_cover, v_img.sort_order, v_img.metadata, v_actor
      );
    END LOOP;
  END IF;

  IF v_copy_prices THEN
    FOR v_price IN
      SELECT * FROM public.branch_product_prices
      WHERE product_id = v_source_id AND deleted_at IS NULL AND is_active = true
    LOOP
      INSERT INTO public.branch_product_prices (
        organization_id, branch_id, product_id, variant_id,
        retail_price, wholesale_price, discount_price, created_by
      ) VALUES (
        v_org_id, v_price.branch_id, v_new_id, NULL,
        v_price.retail_price, v_price.wholesale_price, v_price.discount_price, v_actor
      );
    END LOOP;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, NULL, v_actor, 'product.duplicate', 'product', v_new_id,
    NULL,
    jsonb_build_object('source_product_id', v_source_id)
  );

  RETURN jsonb_build_object('product_id', v_new_id, 'status', 'draft');
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_product(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- transition_product_status
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_product_status(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_product_id uuid;
  v_to text;
  v_reason text;
  v_p public.products%ROWTYPE;
  v_variant_count int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_org_id := public.current_organization_id();
  v_product_id := (payload->>'product_id')::uuid;
  v_to := payload->>'status';
  v_reason := NULLIF(trim(payload->>'reason'), '');

  SELECT * INTO v_p FROM public.products
  WHERE id = v_product_id AND organization_id = v_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  IF v_to = 'pending_approval' THEN
    IF NOT (public.user_has_permission('products.submit') OR public.user_has_permission('products.update')) THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  ELSIF v_to = 'approved' OR v_to = 'active' THEN
    IF NOT public.user_has_permission('products.approve') THEN
      RAISE EXCEPTION 'Permission denied to approve';
    END IF;
    IF v_p.created_by = v_actor AND NOT public.user_has_permission('settings.manage') THEN
      -- allow Owner/Super Admin via *; block self-approve for limited roles
      IF NOT public.user_has_permission('products.approve') THEN
        RAISE EXCEPTION 'Cannot approve own product';
      END IF;
    END IF;
  ELSIF v_to = 'rejected' THEN
    IF NOT public.user_has_permission('products.reject') THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
    IF v_reason IS NULL THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
  ELSIF v_to = 'archived' THEN
    IF NOT public.user_has_permission('products.archive') THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  ELSIF v_to IN ('draft', 'inactive') THEN
    IF NOT public.user_has_permission('products.update') THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid status %', v_to;
  END IF;

  SELECT count(*) INTO v_variant_count
  FROM public.product_variants
  WHERE product_id = v_product_id AND deleted_at IS NULL AND is_active = true;

  IF v_to IN ('approved', 'active') THEN
    IF NULLIF(v_p.name, '') IS NULL OR v_p.category_id IS NULL THEN
      RAISE EXCEPTION 'Name and category required';
    END IF;
    IF v_variant_count < 1 THEN
      RAISE EXCEPTION 'At least one active variant required';
    END IF;
  END IF;

  UPDATE public.products SET
    status = v_to,
    is_active = (v_to = 'active'),
    published_at = CASE
      WHEN v_to = 'active' AND COALESCE((payload->>'publish')::boolean, true)
        THEN COALESCE(published_at, timezone('utc', now()))
      WHEN v_to IN ('inactive', 'archived', 'draft', 'rejected') THEN NULL
      ELSE published_at
    END,
    submitted_at = CASE WHEN v_to = 'pending_approval' THEN timezone('utc', now()) ELSE submitted_at END,
    submitted_by = CASE WHEN v_to = 'pending_approval' THEN v_actor ELSE submitted_by END,
    approved_at = CASE WHEN v_to IN ('approved', 'active') THEN timezone('utc', now()) ELSE approved_at END,
    approved_by = CASE WHEN v_to IN ('approved', 'active') THEN v_actor ELSE approved_by END,
    rejected_at = CASE WHEN v_to = 'rejected' THEN timezone('utc', now()) ELSE rejected_at END,
    rejected_by = CASE WHEN v_to = 'rejected' THEN v_actor ELSE rejected_by END,
    rejection_reason = CASE WHEN v_to = 'rejected' THEN v_reason ELSE rejection_reason END,
    updated_by = v_actor
  WHERE id = v_product_id;

  PERFORM public.write_audit_log(
    v_org_id, NULL, v_actor, 'product.status_change', 'product', v_product_id,
    jsonb_build_object('from', v_p.status),
    jsonb_build_object('to', v_to, 'reason', v_reason),
    v_reason
  );

  RETURN jsonb_build_object('product_id', v_product_id, 'status', v_to);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_product_status(jsonb) TO authenticated;

-- Alias post_sale → complete_pos_sale for API clarity
CREATE OR REPLACE FUNCTION public.post_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.complete_pos_sale(payload);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_sale(jsonb) TO authenticated;
