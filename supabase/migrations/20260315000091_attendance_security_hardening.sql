-- Migration 091: Attendance security foundation (secrets, idempotency hash, QR HMAC cols, rate limits, adjustments)
-- Forward-only. Does not edit 086–090.

--------------------------------------------------------------------------------
-- Runtime secrets (SECURITY DEFINER helpers only)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_runtime_secrets (
  key text PRIMARY KEY,
  secret_value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by uuid REFERENCES public.profiles (id)
);

ALTER TABLE public.app_runtime_secrets ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated — only SECURITY DEFINER / service_role

INSERT INTO public.app_runtime_secrets (key, secret_value, description)
VALUES
  (
    'attendance_submit_hmac',
    encode(extensions.gen_random_bytes(32), 'hex'),
    'HMAC secret for Edge→RPC attendance submit attestation'
  ),
  (
    'attendance_qr_hmac',
    encode(extensions.gen_random_bytes(32), 'hex'),
    'HMAC secret for branch QR payloads'
  )
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._attendance_secret(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT secret_value FROM public.app_runtime_secrets WHERE key = p_key;
$$;

REVOKE ALL ON FUNCTION public._attendance_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._attendance_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public._attendance_hmac_hex(p_secret_key text, p_message text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT encode(
    extensions.hmac(p_message, public._attendance_secret(p_secret_key), 'sha256'),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION public._attendance_hmac_hex(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._attendance_hmac_hex(text, text) TO service_role;

--------------------------------------------------------------------------------
-- Idempotency payload binding
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_idempotency_payloads (
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  event_id uuid REFERENCES public.attendance_events (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (organization_id, idempotency_key)
);

ALTER TABLE public.attendance_idempotency_payloads ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- Rate limits
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  hit_count int NOT NULL DEFAULT 1,
  UNIQUE (organization_id, bucket_key, window_started_at)
);

ALTER TABLE public.attendance_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._attendance_rate_limit(
  p_org_id uuid,
  p_bucket text,
  p_limit int,
  p_window_seconds int DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', timezone('utc', now()));
  v_count int;
BEGIN
  INSERT INTO public.attendance_rate_limits (organization_id, bucket_key, window_started_at, hit_count)
  VALUES (p_org_id, p_bucket, v_window, 1)
  ON CONFLICT (organization_id, bucket_key, window_started_at)
  DO UPDATE SET hit_count = public.attendance_rate_limits.hit_count + 1
  RETURNING hit_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public._attendance_rate_limit(uuid, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._attendance_rate_limit(uuid, text, int, int) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- App version policy
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_app_version_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  minimum_version text NOT NULL DEFAULT '1.0.0',
  latest_version text,
  force_update boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (organization_id, platform)
);

ALTER TABLE public.attendance_app_version_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_app_version_policy_select ON public.attendance_app_version_policy;
CREATE POLICY attendance_app_version_policy_select ON public.attendance_app_version_policy
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = public.current_organization_id()
  );

INSERT INTO public.attendance_app_version_policy (organization_id, platform, minimum_version)
VALUES (NULL, 'android', '1.0.0'), (NULL, 'ios', '1.0.0')
ON CONFLICT DO NOTHING;

--------------------------------------------------------------------------------
-- Risk policy defaults
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_risk_policies (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id),
  accept_max int NOT NULL DEFAULT 29,
  flag_max int NOT NULL DEFAULT 59,
  review_max int NOT NULL DEFAULT 89,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.attendance_risk_policies ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- Immutable attendance adjustments (corrections)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  attendance_record_id uuid REFERENCES public.attendance_records (id),
  work_date date NOT NULL,
  correction_request_id uuid REFERENCES public.attendance_correction_requests (id),
  before_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  approved_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.attendance_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_adjustments_select ON public.attendance_adjustments;
CREATE POLICY attendance_adjustments_select ON public.attendance_adjustments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

--------------------------------------------------------------------------------
-- Extend challenges + QR tokens
--------------------------------------------------------------------------------
ALTER TABLE public.attendance_challenges
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.work_shifts (id),
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.attendance_locations (id),
  ADD COLUMN IF NOT EXISTS integrity_nonce_hash text,
  ADD COLUMN IF NOT EXISTS qr_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_context jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.attendance_branch_qr_tokens
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS hmac_signature text,
  ADD COLUMN IF NOT EXISTS single_use boolean NOT NULL DEFAULT false;

ALTER TABLE public.attendance_events
  ADD COLUMN IF NOT EXISTS canonical_payload_hash text,
  ADD COLUMN IF NOT EXISTS attestation_valid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS biometric_gate_used boolean NOT NULL DEFAULT false;

--------------------------------------------------------------------------------
-- Device unique index: org + employee, revoked_at null
--------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.employee_attendance_devices_one_approved_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_one_active_attendance_device
  ON public.employee_attendance_devices (organization_id, employee_id)
  WHERE deleted_at IS NULL
    AND is_active = true
    AND status = 'approved'
    AND revoked_at IS NULL;
