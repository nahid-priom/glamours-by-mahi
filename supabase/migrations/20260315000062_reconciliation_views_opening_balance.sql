-- Reconciliation views: include opening balance documents in expected party due

DROP VIEW IF EXISTS public.v_recon_customer_due_vs_sales CASCADE;
DROP VIEW IF EXISTS public.v_recon_supplier_due_vs_purchases CASCADE;

CREATE VIEW public.v_recon_customer_due_vs_sales AS
SELECT
  c.organization_id,
  c.id AS customer_id,
  c.name,
  c.current_due AS customer_due,
  coalesce((
    SELECT sum(s.due_total)
    FROM public.sales s
    WHERE s.customer_id = c.id
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
  ), 0) AS open_sale_due,
  coalesce((
    SELECT sum(d.amount)
    FROM public.opening_balance_documents d
    WHERE d.organization_id = c.organization_id
      AND d.party_id = c.id
      AND d.document_type = 'customer_opening_balance'
      AND d.deleted_at IS NULL
  ), 0) AS opening_balance_due,
  c.current_due - (
    coalesce((
      SELECT sum(s.due_total)
      FROM public.sales s
      WHERE s.customer_id = c.id
        AND s.deleted_at IS NULL
        AND s.status = 'completed'
    ), 0)
    + coalesce((
      SELECT sum(d.amount)
      FROM public.opening_balance_documents d
      WHERE d.organization_id = c.organization_id
        AND d.party_id = c.id
        AND d.document_type = 'customer_opening_balance'
        AND d.deleted_at IS NULL
    ), 0)
  ) AS delta
FROM public.customers c
WHERE c.deleted_at IS NULL;

CREATE VIEW public.v_recon_supplier_due_vs_purchases AS
SELECT
  s.organization_id,
  s.id AS supplier_id,
  s.name,
  s.current_due AS supplier_due,
  coalesce((
    SELECT sum(p.due_total)
    FROM public.purchases p
    WHERE p.supplier_id = s.id
      AND p.deleted_at IS NULL
      AND p.status = 'completed'
  ), 0) AS open_purchase_due,
  coalesce((
    SELECT sum(d.amount)
    FROM public.opening_balance_documents d
    WHERE d.organization_id = s.organization_id
      AND d.party_id = s.id
      AND d.document_type = 'supplier_opening_balance'
      AND d.deleted_at IS NULL
  ), 0) AS opening_balance_due,
  s.current_due - (
    coalesce((
      SELECT sum(p.due_total)
      FROM public.purchases p
      WHERE p.supplier_id = s.id
        AND p.deleted_at IS NULL
        AND p.status = 'completed'
    ), 0)
    + coalesce((
      SELECT sum(d.amount)
      FROM public.opening_balance_documents d
      WHERE d.organization_id = s.organization_id
        AND d.party_id = s.id
        AND d.document_type = 'supplier_opening_balance'
        AND d.deleted_at IS NULL
    ), 0)
  ) AS delta
FROM public.suppliers s
WHERE s.deleted_at IS NULL;
