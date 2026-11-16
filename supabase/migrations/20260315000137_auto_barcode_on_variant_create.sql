-- Auto-allocate + register barcodes when variants are created without one.
-- Keeps product_variants.barcode and product_barcodes in sync (additive).

CREATE OR REPLACE FUNCTION public.trg_sync_product_barcode_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempt int := 0;
BEGIN
  -- Avoid recursion from allocate UPDATE of barcode
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.barcode IS NULL OR btrim(NEW.barcode) = '' THEN
    LOOP
      v_attempt := v_attempt + 1;
      IF v_attempt > 40 THEN
        RAISE EXCEPTION 'Could not allocate unique barcode for variant %', NEW.id;
      END IF;
      v_code := lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.product_variants
        WHERE organization_id = NEW.organization_id
          AND deleted_at IS NULL
          AND public.normalize_barcode(barcode) = public.normalize_barcode(v_code)
      ) AND NOT EXISTS (
        SELECT 1 FROM public.product_barcodes
        WHERE organization_id = NEW.organization_id
          AND deleted_at IS NULL
          AND conflict_flag = false
          AND code_normalized = public.normalize_barcode(v_code)
      );
    END LOOP;

    UPDATE public.product_variants
    SET barcode = v_code, updated_at = now()
    WHERE id = NEW.id;

    INSERT INTO public.product_barcodes (
      organization_id, product_id, variant_id, code, kind, is_primary, source, created_by
    ) VALUES (
      NEW.organization_id, NEW.product_id, NEW.id, v_code, 'internal', true, 'auto_create_trigger',
      public.current_profile_id()
    );

    NEW.barcode := v_code;
    RETURN NEW;
  END IF;

  -- Provided barcode: register if missing
  IF NOT EXISTS (
    SELECT 1 FROM public.product_barcodes pb
    WHERE pb.organization_id = NEW.organization_id
      AND pb.deleted_at IS NULL
      AND pb.code_normalized = public.normalize_barcode(NEW.barcode)
      AND pb.conflict_flag = false
  ) THEN
    INSERT INTO public.product_barcodes (
      organization_id, product_id, variant_id, code, kind, is_primary, source, created_by
    ) VALUES (
      NEW.organization_id, NEW.product_id, NEW.id, btrim(NEW.barcode), 'external', true, 'variant_barcode_sync',
      public.current_profile_id()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_barcode_registry_trg ON public.product_variants;
CREATE TRIGGER product_variants_barcode_registry_trg
  AFTER INSERT OR UPDATE OF barcode ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_product_barcode_registry();

-- Backfill registry for active variants that have barcodes but no registry row
INSERT INTO public.product_barcodes (
  organization_id, product_id, variant_id, code, kind, is_primary, source
)
SELECT
  pv.organization_id,
  pv.product_id,
  pv.id,
  btrim(pv.barcode),
  'legacy',
  true,
  'backfill_00137'
FROM public.product_variants pv
WHERE pv.deleted_at IS NULL
  AND pv.barcode IS NOT NULL
  AND btrim(pv.barcode) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.product_barcodes pb
    WHERE pb.organization_id = pv.organization_id
      AND pb.deleted_at IS NULL
      AND pb.variant_id = pv.id
  );
