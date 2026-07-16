-- Migration 017: HRM core tables for employees, devices, attendance, leave, payroll

--------------------------------------------------------------------------------
-- employees
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  employee_code text NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  photo_path text,
  department text,
  designation text,
  shift_name text,
  joining_date date,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  salary_type text NOT NULL DEFAULT 'monthly'
    CHECK (salary_type IN ('monthly', 'daily', 'hourly')),
  basic_salary numeric(14, 2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  allowances jsonb NOT NULL DEFAULT '{}'::jsonb,
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  profile_id uuid REFERENCES public.profiles (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS employees_org_code_active_uidx
  ON public.employees (organization_id, employee_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS employees_organization_id_idx ON public.employees (organization_id);
CREATE INDEX IF NOT EXISTS employees_branch_id_idx ON public.employees (branch_id);

CREATE TRIGGER employees_set_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- attendance_devices
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  serial_number text,
  base_url text,
  secret_ref text,
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS attendance_devices_org_idx
  ON public.attendance_devices (organization_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER attendance_devices_set_updated_at
  BEFORE UPDATE ON public.attendance_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- employee_device_mappings (employee_code ≠ device user id)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_device_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  device_id uuid NOT NULL REFERENCES public.attendance_devices (id),
  device_user_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_device_mappings_active_uidx
  ON public.employee_device_mappings (device_id, device_user_id)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS employee_device_mappings_employee_idx
  ON public.employee_device_mappings (employee_id);

CREATE TRIGGER employee_device_mappings_set_updated_at
  BEFORE UPDATE ON public.employee_device_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- attendance_raw_logs (immutable punches)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_raw_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  device_id uuid REFERENCES public.attendance_devices (id),
  device_user_id text NOT NULL,
  employee_id uuid REFERENCES public.employees (id),
  punched_at timestamptz NOT NULL,
  punch_type text NOT NULL DEFAULT 'unknown'
    CHECK (punch_type IN ('in', 'out', 'break', 'unknown')),
  external_event_id text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processed', 'ignored', 'error')),
  processed_at timestamptz,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_raw_logs_external_uidx
  ON public.attendance_raw_logs (organization_id, device_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS attendance_raw_logs_org_punched_idx
  ON public.attendance_raw_logs (organization_id, punched_at DESC);

--------------------------------------------------------------------------------
-- attendance_records (daily summarized)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  branch_id uuid REFERENCES public.branches (id),
  work_date date NOT NULL,
  status text NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'leave', 'holiday', 'weekly_off', 'half_day', 'missing_checkout')),
  first_in timestamptz,
  last_out timestamptz,
  late_minutes int NOT NULL DEFAULT 0,
  early_leave_minutes int NOT NULL DEFAULT 0,
  working_minutes int NOT NULL DEFAULT 0,
  overtime_minutes int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_employee_date_uidx
  ON public.attendance_records (employee_id, work_date)
  WHERE deleted_at IS NULL;

CREATE TRIGGER attendance_records_set_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- leave_requests
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  leave_type text NOT NULL DEFAULT 'casual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(6, 1) NOT NULL DEFAULT 1,
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid REFERENCES public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT leave_requests_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS leave_requests_org_status_idx
  ON public.leave_requests (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER leave_requests_set_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- payroll_runs / payroll_items
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  period_label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'calculated', 'approved', 'paid', 'cancelled')),
  total_gross numeric(14, 2) NOT NULL DEFAULT 0,
  total_deductions numeric(14, 2) NOT NULL DEFAULT 0,
  total_net numeric(14, 2) NOT NULL DEFAULT 0,
  approved_at timestamptz,
  paid_at timestamptz,
  journal_entry_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS payroll_runs_org_period_idx
  ON public.payroll_runs (organization_id, period_start DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER payroll_runs_set_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  basic_salary numeric(14, 2) NOT NULL DEFAULT 0,
  allowances numeric(14, 2) NOT NULL DEFAULT 0,
  overtime numeric(14, 2) NOT NULL DEFAULT 0,
  bonus numeric(14, 2) NOT NULL DEFAULT 0,
  attendance_deduction numeric(14, 2) NOT NULL DEFAULT 0,
  leave_deduction numeric(14, 2) NOT NULL DEFAULT 0,
  other_deductions numeric(14, 2) NOT NULL DEFAULT 0,
  net_salary numeric(14, 2) NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_items_run_employee_uidx
  ON public.payroll_items (payroll_run_id, employee_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER payroll_items_set_updated_at
  BEFORE UPDATE ON public.payroll_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_device_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_raw_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_org_all ON public.employees
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY attendance_devices_org_all ON public.attendance_devices
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY employee_device_mappings_org_all ON public.employee_device_mappings
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY attendance_raw_logs_org_all ON public.attendance_raw_logs
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY attendance_records_org_all ON public.attendance_records
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY leave_requests_org_all ON public.leave_requests
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY payroll_runs_org_all ON public.payroll_runs
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY payroll_items_org_all ON public.payroll_items
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());
