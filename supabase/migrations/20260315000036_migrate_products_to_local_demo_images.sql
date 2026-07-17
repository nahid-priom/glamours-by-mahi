-- One-time product image migration.
-- Replaces every current, non-deleted product's authoritative cover image and
-- variant image overrides with one of the eight verified public/products files.
-- Previous references are recoverable from immutable audit_logs.before_data.

DO $migration$
DECLARE
  v_marker constant text := 'product-demo-image-migration-v1';
  v_paths constant text[] := ARRAY[
    '/products/1.png',
    '/products/2.png',
    '/products/3.png',
    '/products/4.png',
    '/products/6 (1).png',
    '/products/7.png',
    '/products/8.png',
    '/products/89.png'
  ];
  v_product record;
  v_primary_image_id uuid;
  v_previous_images jsonb;
  v_previous_variants jsonb;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_backup_count integer := 0;
  v_distribution record;
BEGIN
  FOR v_product IN
    SELECT
      p.id,
      p.organization_id,
      v_paths[
        ((row_number() OVER (
          ORDER BY hashtextextended(p.id::text, 0), p.id
        ) - 1) % array_length(v_paths, 1))::integer + 1
      ] AS assigned_path
    FROM public.products p
    WHERE p.deleted_at IS NULL
    ORDER BY hashtextextended(p.id::text, 0), p.id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.audit_logs a
      WHERE a.organization_id = v_product.organization_id
        AND a.entity_type = 'product'
        AND a.entity_id = v_product.id
        AND a.action = v_marker
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'storage_path', pi.storage_path,
            'variant_id', pi.variant_id,
            'is_cover', pi.is_cover,
            'sort_order', pi.sort_order,
            'metadata', pi.metadata,
            'deleted_at', pi.deleted_at
          )
          ORDER BY pi.variant_id NULLS FIRST, pi.is_cover DESC, pi.sort_order, pi.id
        ),
        '[]'::jsonb
      )
      INTO v_previous_images
      FROM public.product_images pi
      WHERE pi.product_id = v_product.id;

      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', pv.id,
            'image_path', pv.image_path,
            'deleted_at', pv.deleted_at
          )
          ORDER BY pv.id
        ),
        '[]'::jsonb
      )
      INTO v_previous_variants
      FROM public.product_variants pv
      WHERE pv.product_id = v_product.id;

      INSERT INTO public.audit_logs (
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        reason,
        request_meta
      ) VALUES (
        v_product.organization_id,
        NULL,
        v_marker,
        'product',
        v_product.id,
        jsonb_build_object(
          'product_images', v_previous_images,
          'variant_images', v_previous_variants
        ),
        jsonb_build_object('assigned_path', v_product.assigned_path),
        'One-time migration to verified local demo product images',
        jsonb_build_object(
          'migration', v_marker,
          'recoverable', true,
          'verified_paths', to_jsonb(v_paths)
        )
      );
      v_backup_count := v_backup_count + 1;

      SELECT pi.id
      INTO v_primary_image_id
      FROM public.product_images pi
      WHERE pi.product_id = v_product.id
        AND pi.variant_id IS NULL
        AND pi.deleted_at IS NULL
      ORDER BY pi.is_cover DESC, pi.sort_order, pi.created_at, pi.id
      LIMIT 1;

      IF v_primary_image_id IS NULL THEN
        INSERT INTO public.product_images (
          organization_id,
          product_id,
          variant_id,
          storage_path,
          is_cover,
          sort_order,
          metadata
        ) VALUES (
          v_product.organization_id,
          v_product.id,
          NULL,
          v_product.assigned_path,
          true,
          0,
          jsonb_build_object('migration', v_marker)
        )
        RETURNING id INTO v_primary_image_id;
      ELSE
        UPDATE public.product_images
        SET storage_path = v_product.assigned_path,
            is_cover = true,
            sort_order = 0,
            metadata = coalesce(metadata, '{}'::jsonb)
              || jsonb_build_object('migration', v_marker),
            updated_at = timezone('utc', now())
        WHERE id = v_primary_image_id;
      END IF;

      -- Keep exactly one active product-level image. Storage objects are not deleted.
      UPDATE public.product_images
      SET deleted_at = timezone('utc', now()),
          is_cover = false,
          updated_at = timezone('utc', now())
      WHERE product_id = v_product.id
        AND variant_id IS NULL
        AND deleted_at IS NULL
        AND id <> v_primary_image_id;

      -- Variant image_path overrides product covers in POS; align those references.
      UPDATE public.product_variants
      SET image_path = v_product.assigned_path,
          updated_at = timezone('utc', now())
      WHERE product_id = v_product.id
        AND deleted_at IS NULL;

      UPDATE public.products
      SET updated_at = timezone('utc', now())
      WHERE id = v_product.id;

      v_updated := v_updated + 1;
      v_primary_image_id := NULL;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'Product demo image migration failed for product %: %',
        v_product.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE
    'product-demo-image-migration-v1: updated=%, skipped=%, failed=%, backups=%',
    v_updated, v_skipped, v_failed, v_backup_count;

  FOR v_distribution IN
    SELECT
      a.after_data->>'assigned_path' AS image_path,
      count(*) AS product_count
    FROM public.audit_logs a
    WHERE a.action = v_marker
      AND a.entity_type = 'product'
    GROUP BY a.after_data->>'assigned_path'
    ORDER BY a.after_data->>'assigned_path'
  LOOP
    RAISE NOTICE 'distribution: % = % products',
      v_distribution.image_path, v_distribution.product_count;
  END LOOP;

  IF v_failed > 0 THEN
    RAISE EXCEPTION
      'product-demo-image-migration-v1 rolled back: % product(s) failed',
      v_failed;
  END IF;
END;
$migration$;

