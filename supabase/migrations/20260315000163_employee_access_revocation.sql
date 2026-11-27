-- Revoke linked application access when employment ends or a record is archived.
-- Existing active JWTs remain issued, but server authorization reads profiles.is_active.
-- Reactivation of an Auth/profile account remains an explicit administration action.

CREATE OR REPLACE FUNCTION public.revoke_ineligible_employee_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.profile_id IS NOT NULL
     AND (NEW.status IN ('inactive', 'terminated') OR NEW.deleted_at IS NOT NULL)
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
     AND NOT EXISTS (
       SELECT 1 FROM public.employees e
       WHERE e.id <> NEW.id
         AND e.organization_id = NEW.organization_id
         AND e.profile_id = NEW.profile_id
         AND e.status = 'active'
         AND e.deleted_at IS NULL
     ) THEN
    UPDATE public.profiles p
    SET is_active = false,
        updated_by = COALESCE(NEW.updated_by, auth.uid())
    WHERE p.id = NEW.profile_id
      AND p.organization_id = NEW.organization_id
      AND p.is_active = true
      AND p.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_ineligible_employee_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employees_revoke_ineligible_profile ON public.employees;
CREATE TRIGGER employees_revoke_ineligible_profile
  AFTER UPDATE OF status, deleted_at ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_ineligible_employee_profile();
