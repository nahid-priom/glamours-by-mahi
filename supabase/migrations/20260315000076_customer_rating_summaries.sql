-- Migration 076: Customer rating summaries (auto-scored behaviour)

CREATE TABLE IF NOT EXISTS public.customer_rating_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  branch_id uuid REFERENCES public.branches (id),
  score numeric(3, 1) NOT NULL DEFAULT 3.0
    CHECK (score >= 1.0 AND score <= 5.0),
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_rating_summaries_org_customer_uidx
  ON public.customer_rating_summaries (organization_id, customer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customer_rating_summaries_org_score_idx
  ON public.customer_rating_summaries (organization_id, score DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER customer_rating_summaries_set_updated_at
  BEFORE UPDATE ON public.customer_rating_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customer_rating_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_rating_summaries_select ON public.customer_rating_summaries;
CREATE POLICY customer_rating_summaries_select
  ON public.customer_rating_summaries
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.read')
      OR public.user_has_permission('customers.manage')
      OR public.user_has_permission('pos.create')
      OR public.user_has_permission('sales.read')
    )
  );

DROP POLICY IF EXISTS customer_rating_summaries_write ON public.customer_rating_summaries;
CREATE POLICY customer_rating_summaries_write
  ON public.customer_rating_summaries
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.manage')
      OR public.user_has_permission('accounts.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.manage')
      OR public.user_has_permission('accounts.manage')
    )
  );

GRANT SELECT ON public.customer_rating_summaries TO authenticated;
GRANT ALL ON public.customer_rating_summaries TO service_role;
