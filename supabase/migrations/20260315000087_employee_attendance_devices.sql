-- Migration 087: Employee mobile attendance devices (separate from hardware attendance_devices)
-- Forward-only. One approved active device per employee by default.

--------------------------------------------------------------------------------
-- employee_attendance_devices
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  auth_user_id uuid NOT NULL REFERENCES public.profiles (id),
  installation_id text NOT NULL,
  platform text NOT NULL DEFAULT 'android'
    CHECK (platform IN ('android', 'ios', 'web')),
  device_name text,
  device_model text,
  operating_system text,
  os_version text,
  app_version text,
  public_key text NOT NULL,
  biometric_supported boolean NOT NULL DEFAULT false,
  biometric_type text,
  integrity_provider text,
  integrity_status text NOT NULL DEFAULT 'unknown'
    CHECK (integrity_status IN ('unknown', 'passed', 'failed', 'bypassed_dev')),
  registration_latitude double precision,
  registration_longitude double precision,
  registration_accuracy double precision,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'revoked', 'blocked')),
  is_active boolean NOT NULL DEFAULT true,
  approved_by uuid REFERENCES public.profiles (id),
  approved_at timestamptz,
  last_used_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

-- One approved active device per employee
CREATE UNIQUE INDEX IF NOT EXISTS employee_attendance_devices_one_approved_uidx
  ON public.employee_attendance_devices (employee_id)
  WHERE deleted_at IS NULL
    AND is_active = true
    AND status = 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS employee_attendance_devices_install_uidx
  ON public.employee_attendance_devices (organization_id, installation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS employee_attendance_devices_emp_status_idx
  ON public.employee_attendance_devices (employee_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER employee_attendance_devices_set_updated_at
  BEFORE UPDATE ON public.employee_attendance_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- attendance_device_requests (change / first registration workflow)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_device_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  auth_user_id uuid NOT NULL REFERENCES public.profiles (id),
  request_type text NOT NULL DEFAULT 'register'
    CHECK (request_type IN ('register', 'change', 'reactivate')),
  device_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_key text NOT NULL,
  installation_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  resulting_device_id uuid REFERENCES public.employee_attendance_devices (id),
  reviewed_by uuid REFERENCES public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS attendance_device_requests_pending_idx
  ON public.attendance_device_requests (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER attendance_device_requests_set_updated_at
  BEFORE UPDATE ON public.attendance_device_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- attendance_device_audit_logs (immutable)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_device_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid REFERENCES public.employees (id),
  device_id uuid REFERENCES public.employee_attendance_devices (id),
  actor_user_id uuid REFERENCES public.profiles (id),
  action text NOT NULL,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS attendance_device_audit_logs_device_idx
  ON public.attendance_device_audit_logs (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_device_audit_logs_org_idx
  ON public.attendance_device_audit_logs (organization_id, created_at DESC);

--------------------------------------------------------------------------------
-- RLS (refined in 00089 for employee self-read)
--------------------------------------------------------------------------------
ALTER TABLE public.employee_attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_device_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_device_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_attendance_devices_org_all ON public.employee_attendance_devices;
CREATE POLICY employee_attendance_devices_org_all ON public.employee_attendance_devices
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS attendance_device_requests_org_all ON public.attendance_device_requests;
CREATE POLICY attendance_device_requests_org_all ON public.attendance_device_requests
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS attendance_device_audit_logs_org_select ON public.attendance_device_audit_logs;
CREATE POLICY attendance_device_audit_logs_org_select ON public.attendance_device_audit_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

-- No direct INSERT/UPDATE/DELETE for clients on audit logs (RPC / service_role only)
