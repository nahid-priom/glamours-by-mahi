-- Fix infinite reversal loop: skip reversal entries (reversed_entry_id IS NOT NULL)

CREATE OR REPLACE FUNCTION public._reverse_journal_for_source(
  p_org_id uuid,
  p_branch_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_memo text,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig public.journal_entries%ROWTYPE;
  v_rev_id uuid;
  v_entry_no text;
  v_line public.journal_lines%ROWTYPE;
  v_line_no int := 0;
BEGIN
  SELECT * INTO v_orig
  FROM public.journal_entries je
  WHERE je.organization_id = p_org_id
    AND je.source_type = p_source_type
    AND je.source_id = p_source_id
    AND je.status = 'posted'
    AND je.deleted_at IS NULL
    AND je.reversed_entry_id IS NULL
  ORDER BY je.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_entry_no := 'JE-REV-' || replace(v_orig.id::text, '-', '');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, period_id, entry_no, entry_date, status,
    source_type, source_id, memo, posted_at, reversed_entry_id, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, v_orig.period_id, v_entry_no,
    (timezone('utc', now()))::date, 'posted',
    p_source_type, p_source_id, p_memo, timezone('utc', now()),
    v_orig.id, p_actor, p_actor
  )
  RETURNING id INTO v_rev_id;

  FOR v_line IN
    SELECT * FROM public.journal_lines jl
    WHERE jl.journal_entry_id = v_orig.id
      AND jl.deleted_at IS NULL
    ORDER BY jl.line_no
  LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id, financial_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      p_org_id, v_rev_id, v_line.chart_account_id, v_line.financial_account_id,
      coalesce('Reversal: ' || v_line.description, 'Reversal'),
      v_line.credit, v_line.debit, v_line_no, p_actor, p_actor
    );
  END LOOP;

  UPDATE public.journal_entries
  SET status = 'reversed',
      updated_by = p_actor
  WHERE id = v_orig.id;

  RETURN v_rev_id;
END;
$$;

REVOKE ALL ON FUNCTION public._reverse_journal_for_source(uuid, uuid, text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._reverse_journal_for_source(uuid, uuid, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._reverse_journal_for_source(uuid, uuid, text, uuid, text, uuid) TO service_role;
