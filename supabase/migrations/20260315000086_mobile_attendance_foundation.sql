-- Migration 086: Mobile attendance foundation (shifts, locations, attendance_records extensions)
-- Audit: scripts/mobile-attendance-audit.md
-- Forward-only. Does not alter hardware attendance_devices or calculate_payroll_run.

--------------------------------------------------------------------------------
-- work_shifts
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  code text NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  start_time time NOT NULL,
  end_time time NOT NULL,
  check_in_opens_minutes_before int NOT NULL DEFAULT 30,
  on_time_until_minutes int NOT NULL DEFAULT 0,
  late_until_minutes int NOT NULL DEFAULT 30,
  check_in_closes_minutes_after int NOT NULL DEFAULT 30,
  check_out_opens_minutes_before int NOT NULL DEFAULT 0,
  check_out_closes_minutes_after int NOT NULL DEFAULT 30,
  early_leave_grace_minutes int NOT NULL DEFAULT 0,
  overtime_after_minutes int NOT NULL DEFAULT 0,
  is_overnight boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT work_shifts_code_nonempty CHECK (length(btrim(code)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_org_code_active_uidx
  ON public.work_shifts (organization_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS work_shifts_org_idx
  ON public.work_shifts (organization_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER work_shifts_set_updated_at
  BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- employee_shift_assignments
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  shift_id uuid NOT NULL REFERENCES public.work_shifts (id),
  effective_from date NOT NULL DEFAULT (timezone('utc', now()))::date,
  effective_to date,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT employee_shift_assignments_dates CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS employee_shift_assignments_emp_idx
  ON public.employee_shift_assignments (employee_id, effective_from DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER employee_shift_assignments_set_updated_at
  BEFORE UPDATE ON public.employee_shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- attendance_locations (branch geo-fence; admin-configured only)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  allowed_radius_metres numeric(10, 2) NOT NULL DEFAULT 50
    CHECK (allowed_radius_metres > 0),
  maximum_accuracy_metres numeric(10, 2) NOT NULL DEFAULT 25
    CHECK (maximum_accuracy_metres > 0),
  maximum_location_age_seconds int NOT NULL DEFAULT 15
    CHECK (maximum_location_age_seconds > 0),
  is_active boolean NOT NULL DEFAULT true,
  requires_qr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT attendance_locations_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT attendance_locations_lng CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS attendance_locations_branch_idx
  ON public.attendance_locations (branch_id)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE TRIGGER attendance_locations_set_updated_at
  BEFORE UPDATE ON public.attendance_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- Extend attendance_records (additive; keep existing status semantics)
--------------------------------------------------------------------------------
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'device', 'mobile', 'import', 'system')),
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.work_shifts (id),
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_in_event_id uuid,
  ADD COLUMN IF NOT EXISTS check_out_event_id uuid,
  ADD COLUMN IF NOT EXISTS policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_version text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS risk_score numeric(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.attendance_records.source IS
  'Origin of the daily record: manual|device|mobile|import|system';
COMMENT ON COLUMN public.attendance_records.policy_snapshot IS
  'Frozen shift/location policy at punch time for historical stability';

--------------------------------------------------------------------------------
-- RLS (org-scoped; self-scope refined in 00089)
--------------------------------------------------------------------------------
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_shifts_org_all ON public.work_shifts;
CREATE POLICY work_shifts_org_all ON public.work_shifts
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS employee_shift_assignments_org_all ON public.employee_shift_assignments;
CREATE POLICY employee_shift_assignments_org_all ON public.employee_shift_assignments
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS attendance_locations_org_all ON public.attendance_locations;
CREATE POLICY attendance_locations_org_all ON public.attendance_locations
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

-- Seed a default day shift for orgs that already have employees (idempotent)
INSERT INTO public.work_shifts (
  organization_id, code, name, start_time, end_time, timezone
)
SELECT DISTINCT e.organization_id, 'DEFAULT', 'Default Day Shift',
  time '10:00', time '19:00', 'Asia/Dhaka'
FROM public.employees e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.work_shifts ws
    WHERE ws.organization_id = e.organization_id
      AND ws.code = 'DEFAULT'
      AND ws.deleted_at IS NULL
  );
