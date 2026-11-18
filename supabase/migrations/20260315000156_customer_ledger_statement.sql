-- Customer ledger statement RPC (parity with get_supplier_ledger_statement)

CREATE OR REPLACE FUNCTION public.get_customer_ledger_statement(
  p_customer_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_entry_types text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_page int := GREATEST(coalesce(p_page, 1), 1);
  v_size int := LEAST(GREATEST(coalesce(p_page_size, 50), 1), 200);
  v_search text := NULLIF(trim(p_search), '');
  v_opening numeric(14,2) := 0;
  v_sales numeric(14,2) := 0;
  v_collections numeric(14,2) := 0;
  v_returns numeric(14,2) := 0;
  v_adjustments numeric(14,2) := 0;
  v_closing numeric(14,2) := 0;
  v_count int := 0;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organization context required';
  END IF;
  IF NOT (
    public.user_has_permission('customers.read')
    OR public.user_has_permission('accounts.read')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = p_customer_id AND c.organization_id = v_org AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF p_from IS NOT NULL THEN
    SELECT coalesce(sum(cl.debit - cl.credit), 0) INTO v_opening
    FROM public.customer_ledger cl
    WHERE cl.customer_id = p_customer_id
      AND cl.organization_id = v_org
      AND cl.deleted_at IS NULL
      AND cl.occurred_at < p_from
      AND (p_branch_id IS NULL OR cl.branch_id = p_branch_id OR public.user_has_branch_access(cl.branch_id));
  ELSE
    v_opening := 0;
  END IF;

  WITH filtered AS (
    SELECT
      cl.*,
      cl.debit AS due_increase,
      cl.credit AS due_decrease
    FROM public.customer_ledger cl
    WHERE cl.customer_id = p_customer_id
      AND cl.organization_id = v_org
      AND cl.deleted_at IS NULL
      AND (p_from IS NULL OR cl.occurred_at >= p_from)
      AND (p_to IS NULL OR cl.occurred_at <= p_to)
      AND (p_branch_id IS NULL OR cl.branch_id = p_branch_id)
      AND (p_branch_id IS NOT NULL OR cl.branch_id IS NULL OR public.user_has_branch_access(cl.branch_id))
      AND (p_entry_types IS NULL OR cl.entry_type = ANY(p_entry_types))
      AND (
        v_search IS NULL
        OR coalesce(cl.notes, '') ILIKE '%' || v_search || '%'
        OR coalesce(cl.reference_type, '') ILIKE '%' || v_search || '%'
        OR coalesce(cl.entry_type, '') ILIKE '%' || v_search || '%'
      )
  ),
  ordered AS (
    SELECT
      f.*,
      v_opening + sum(f.due_increase - f.due_decrease) OVER (
        ORDER BY f.occurred_at ASC, f.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS running_balance
    FROM filtered f
  ),
  totals AS (
    SELECT
      coalesce(sum(due_increase) FILTER (
        WHERE entry_type IN ('sale_invoice', 'sale_due')
      ), 0) AS sales,
      coalesce(sum(due_decrease) FILTER (
        WHERE entry_type IN ('collection', 'sale_payment')
      ), 0) AS collections,
      coalesce(sum(due_decrease) FILTER (
        WHERE entry_type IN ('return_credit', 'refund')
      ), 0) AS returns,
      coalesce(sum(due_increase - due_decrease) FILTER (
        WHERE entry_type IN ('adjustment', 'opening', 'reversal')
      ), 0) AS adjustments,
      count(*)::int AS total_count
    FROM ordered
  ),
  page AS (
    SELECT *
    FROM ordered
    ORDER BY occurred_at DESC, id DESC
    OFFSET (v_page - 1) * v_size
    LIMIT v_size
  )
  SELECT
    t.sales, t.collections, t.returns, t.adjustments, t.total_count,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'occurred_at', p.occurred_at,
        'branch_id', p.branch_id,
        'entry_type', p.entry_type,
        'reference_type', p.reference_type,
        'reference_id', p.reference_id,
        'notes', p.notes,
        'due_increase', p.due_increase,
        'due_decrease', p.due_decrease,
        'running_balance', p.running_balance
      )
      ORDER BY p.occurred_at DESC, p.id DESC
    ) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb)
  INTO v_sales, v_collections, v_returns, v_adjustments, v_count, v_lines
  FROM totals t
  LEFT JOIN page p ON true
  GROUP BY t.sales, t.collections, t.returns, t.adjustments, t.total_count;

  SELECT coalesce(
    (SELECT o.running_balance FROM (
       SELECT v_opening + sum(cl.debit - cl.credit) OVER (ORDER BY cl.occurred_at ASC, cl.id ASC) AS running_balance,
              row_number() OVER (ORDER BY cl.occurred_at DESC, cl.id DESC) AS rn
       FROM public.customer_ledger cl
       WHERE cl.customer_id = p_customer_id
         AND cl.organization_id = v_org
         AND cl.deleted_at IS NULL
         AND (p_from IS NULL OR cl.occurred_at >= p_from)
         AND (p_to IS NULL OR cl.occurred_at <= p_to)
         AND (p_branch_id IS NULL OR cl.branch_id = p_branch_id)
         AND (p_entry_types IS NULL OR cl.entry_type = ANY(p_entry_types))
     ) o WHERE o.rn = 1),
    v_opening
  ) INTO v_closing;

  RETURN jsonb_build_object(
    'customer_id', p_customer_id,
    'opening_balance', v_opening,
    'total_sales', coalesce(v_sales, 0),
    'total_collections', coalesce(v_collections, 0),
    'total_returns', coalesce(v_returns, 0),
    'total_adjustments', coalesce(v_adjustments, 0),
    'closing_due', coalesce(v_closing, v_opening),
    'page', v_page,
    'page_size', v_size,
    'total_count', coalesce(v_count, 0),
    'lines', coalesce(v_lines, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_ledger_statement(uuid, timestamptz, timestamptz, uuid, text[], text, int, int) TO authenticated;
