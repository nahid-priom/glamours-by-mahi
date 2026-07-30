-- Migration 088: Attendance challenges, events, attempts, correction requests
-- Immutable event/attempt logs; challenges are one-time nonces.

--------------------------------------------------------------------------------
-- attendance_challenges
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  device_id uuid NOT NULL REFERENCES public.employee_attendance_devices (id),
  event_type text NOT NULL CHECK (event_type IN ('check_in', 'check_out')),
  branch_id uuid REFERENCES public.branches (id),
  nonce_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_challenges_nonce_uidx
  ON public.attendance_challenges (organization_id, nonce_hash);

CREATE INDEX IF NOT EXISTS attendance_challenges_emp_open_idx
  ON public.attendance_challenges (employee_id, event_type, expires_at)
  WHERE used_at IS NULL;

--------------------------------------------------------------------------------
-- attendance_events (immutable accepted events)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  attendance_record_id uuid REFERENCES public.attendance_records (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  device_id uuid REFERENCES public.employee_attendance_devices (id),
  challenge_id uuid REFERENCES public.attendance_challenges (id),
  event_type text NOT NULL CHECK (event_type IN ('check_in', 'check_out')),
  server_received_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  client_captured_at timestamptz,
  work_date date NOT NULL,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  altitude double precision,
  heading double precision,
  speed double precision,
  distance_metres numeric(12, 2),
  location_valid boolean NOT NULL DEFAULT false,
  biometric_verified boolean NOT NULL DEFAULT false,
  device_signature_valid boolean NOT NULL DEFAULT false,
  integrity_valid boolean NOT NULL DEFAULT false,
  qr_valid boolean,
  shift_valid boolean NOT NULL DEFAULT false,
  risk_score numeric(8, 2) NOT NULL DEFAULT 0,
  decision text NOT NULL DEFAULT 'accepted'
    CHECK (decision IN ('accepted', 'rejected', 'pending_review')),
  rejection_reason text,
  idempotency_key text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_events_idempotency_uidx
  ON public.attendance_events (organization_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_events_challenge_uidx
  ON public.attendance_events (challenge_id)
  WHERE challenge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS attendance_events_emp_date_idx
  ON public.attendance_events (employee_id, work_date, event_type);

--------------------------------------------------------------------------------
-- attendance_attempts (success + rejected; never silently discard)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid REFERENCES public.employees (id),
  device_id uuid REFERENCES public.employee_attendance_devices (id),
  challenge_id uuid REFERENCES public.attendance_challenges (id),
  event_type text CHECK (event_type IN ('check_in', 'check_out')),
  decision text NOT NULL
    CHECK (decision IN ('accepted', 'rejected', 'pending_review')),
  rejection_reason text,
  risk_score numeric(8, 2) NOT NULL DEFAULT 0,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  distance_metres numeric(12, 2),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS attendance_attempts_org_created_idx
  ON public.attendance_attempts (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_attempts_emp_idx
  ON public.attendance_attempts (employee_id, created_at DESC);

--------------------------------------------------------------------------------
-- attendance_correction_requests
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  attendance_record_id uuid REFERENCES public.attendance_records (id),
  work_date date NOT NULL,
  request_type text NOT NULL
    CHECK (request_type IN (
      'missed_check_in', 'missed_check_out', 'correction', 'outdoor_duty'
    )),
  reason text NOT NULL,
  requested_check_in_at timestamptz,
  requested_check_out_at timestamptz,
  attachment_path text,
  before_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid REFERENCES public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS attendance_correction_requests_pending_idx
  ON public.attendance_correction_requests (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER attendance_correction_requests_set_updated_at
  BEFORE UPDATE ON public.attendance_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- Branch QR rotation tokens (optional high-security branches)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_branch_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  location_id uuid REFERENCES public.attendance_locations (id),
  nonce_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_branch_qr_tokens_nonce_uidx
  ON public.attendance_branch_qr_tokens (organization_id, nonce_hash);

CREATE INDEX IF NOT EXISTS attendance_branch_qr_tokens_branch_idx
  ON public.attendance_branch_qr_tokens (branch_id, expires_at DESC);

--------------------------------------------------------------------------------
-- FK from attendance_records event ids (deferred until events exist)
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_check_in_event_fkey'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_check_in_event_fkey
      FOREIGN KEY (check_in_event_id) REFERENCES public.attendance_events (id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_check_out_event_fkey'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_check_out_event_fkey
      FOREIGN KEY (check_out_event_id) REFERENCES public.attendance_events (id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Deferred FK on attendance_records event ids skipped: %', SQLERRM;
END $$;

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.attendance_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_branch_qr_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_challenges_org_select ON public.attendance_challenges;
CREATE POLICY attendance_challenges_org_select ON public.attendance_challenges
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS attendance_events_org_select ON public.attendance_events;
CREATE POLICY attendance_events_org_select ON public.attendance_events
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS attendance_attempts_org_select ON public.attendance_attempts;
CREATE POLICY attendance_attempts_org_select ON public.attendance_attempts
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS attendance_correction_requests_org_all ON public.attendance_correction_requests;
CREATE POLICY attendance_correction_requests_org_all ON public.attendance_correction_requests
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS attendance_branch_qr_tokens_org_select ON public.attendance_branch_qr_tokens;
CREATE POLICY attendance_branch_qr_tokens_org_select ON public.attendance_branch_qr_tokens
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());
