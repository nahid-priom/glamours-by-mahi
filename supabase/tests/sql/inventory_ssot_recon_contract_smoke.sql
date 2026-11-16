-- Inventory SSOT reconciliation contract smoke (local Supabase).
-- Asserts core objects exist; does not invent PASS for unimplemented supplier provenance.

do $$
begin
  if to_regclass('public.inventory_balances') is null then
    raise exception 'MISSING: public.inventory_balances';
  end if;
  if to_regclass('public.stock_ledger') is null then
    raise exception 'MISSING: public.stock_ledger';
  end if;
end $$;

-- Valuation view / RPC presence (names may evolve — fail loudly if both absent)
do $$
declare
  has_view boolean := to_regclass('public.v_inventory_valuation_balances') is not null;
  has_fn boolean := exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'get_inventory_%'
  );
begin
  if not has_view and not has_fn then
    raise exception 'MISSING: inventory valuation view or get_inventory_* RPC';
  end if;
end $$;

select 'inventory_ssot_recon_contract_smoke_ok' as status;
