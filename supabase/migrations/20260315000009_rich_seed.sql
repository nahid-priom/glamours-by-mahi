-- Glamourous by Mahi Â· Rich catalog & accounting seed
-- Migration 009: expands org aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Idempotent via ON CONFLICT / EXISTS guards where possible

DO $$
DECLARE
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_hq uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_b2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  v_b3 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';
  v_b4 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4';
  v_b5 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5';
  v_assets uuid;
  v_liab uuid;
  v_rev uuid;
  v_exp uuid;
  v_cash_coa uuid;
  v_bank_coa uuid;
  v_mm_coa uuid;
  v_recv_coa uuid;
  v_pay_coa uuid;
  v_inv_coa uuid;
  v_cogs_coa uuid;
  v_sales_coa uuid;
  v_sret_coa uuid;
  v_cash_fa uuid;
  v_bank_fa uuid;
  v_bkash_fa uuid;
  v_year int := extract(year from timezone('utc', now()))::int;
  r record;
  i int;
  j int;
  v_sku text;
  v_barcode text;
  v_sizes text[] := ARRAY['S', 'M', 'L', 'XL'];
  v_colors text[] := ARRAY['Black', 'Ivory', 'Rose', 'Navy', 'Emerald'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE EXCEPTION 'Base organization seed missing; run supabase/seed.sql first';
  END IF;

  --------------------------------------------------------------------------
  -- Account groups (if missing)
  --------------------------------------------------------------------------
  INSERT INTO public.account_groups (id, organization_id, name, account_class, sort_order)
  VALUES
    ('dddddddd-dddd-dddd-dddd-ddddddddddd1', v_org, 'Assets', 'asset', 10),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd2', v_org, 'Liabilities', 'liability', 20),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd3', v_org, 'Equity', 'equity', 30),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd4', v_org, 'Revenue', 'revenue', 40),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd5', v_org, 'Expenses', 'expense', 50)
  ON CONFLICT (id) DO NOTHING;

  v_assets := 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  v_liab := 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
  v_rev := 'dddddddd-dddd-dddd-dddd-ddddddddddd4';
  v_exp := 'dddddddd-dddd-dddd-dddd-ddddddddddd5';

  --------------------------------------------------------------------------
  -- Chart of accounts (BDT retail defaults)
  --------------------------------------------------------------------------
  INSERT INTO public.chart_of_accounts (id, organization_id, group_id, code, name, account_type, system_role)
  VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', v_org, v_assets, '1000', 'Cash on Hand', 'asset', 'cash'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', v_org, v_assets, '1010', 'Main Bank Account', 'asset', 'bank'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', v_org, v_assets, '1020', 'bKash Wallet', 'asset', 'mobile_money'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', v_org, v_assets, '1100', 'Accounts Receivable', 'asset', 'receivable'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', v_org, v_assets, '1200', 'Inventory Asset', 'asset', 'inventory_asset'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6', v_org, v_liab, '2000', 'Accounts Payable', 'liability', 'payable'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee7', v_org, v_liab, '2100', 'Tax Payable', 'liability', 'tax_payable'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee8', v_org, v_liab, '2200', 'Refund Payable', 'liability', 'refund_payable'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee9', v_org, v_rev, '4000', 'Sales Revenue', 'revenue', 'sales_revenue'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10', v_org, v_rev, '4100', 'Sales Returns', 'revenue', 'sales_return'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11', v_org, v_exp, '5000', 'Cost of Goods Sold', 'expense', 'cogs'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12', v_org, v_exp, '5100', 'Purchases', 'expense', 'purchase')
  ON CONFLICT (id) DO NOTHING;

  v_cash_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
  v_bank_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2';
  v_mm_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3';
  v_recv_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4';
  v_inv_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5';
  v_pay_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6';
  v_sales_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee9';
  v_sret_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10';
  v_cogs_coa := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11';

  --------------------------------------------------------------------------
  -- Financial accounts
  --------------------------------------------------------------------------
  INSERT INTO public.financial_accounts (
    id, organization_id, branch_id, chart_account_id, name, account_kind,
    currency, opening_balance, current_balance, is_default, is_active
  ) VALUES
    ('ffffffff-ffff-ffff-ffff-fffffffffff1', v_org, v_hq, v_cash_coa, 'Petty Cash', 'cash', 'BDT', 50000, 50000, true, true),
    ('ffffffff-ffff-ffff-ffff-fffffffffff2', v_org, v_hq, v_bank_coa, 'Main Bank', 'bank', 'BDT', 250000, 250000, false, true),
    ('ffffffff-ffff-ffff-ffff-fffffffffff3', v_org, v_hq, v_mm_coa, 'bKash', 'mobile_money', 'BDT', 35000, 35000, false, true)
  ON CONFLICT (id) DO NOTHING;

  v_cash_fa := 'ffffffff-ffff-ffff-ffff-fffffffffff1';
  v_bank_fa := 'ffffffff-ffff-ffff-ffff-fffffffffff2';
  v_bkash_fa := 'ffffffff-ffff-ffff-ffff-fffffffffff3';

  --------------------------------------------------------------------------
  -- Payment methods
  --------------------------------------------------------------------------
  INSERT INTO public.payment_methods (id, organization_id, code, name, financial_account_id, is_due, sort_order, is_active)
  VALUES
    ('11111111-1111-1111-1111-111111111101', v_org, 'cash', 'Cash', v_cash_fa, false, 10, true),
    ('11111111-1111-1111-1111-111111111102', v_org, 'bank', 'Bank Transfer', v_bank_fa, false, 20, true),
    ('11111111-1111-1111-1111-111111111103', v_org, 'bkash', 'bKash', v_bkash_fa, false, 30, true),
    ('11111111-1111-1111-1111-111111111104', v_org, 'due', 'Due / Credit', NULL, true, 40, true)
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Financial period (current year)
  --------------------------------------------------------------------------
  INSERT INTO public.financial_periods (id, organization_id, name, start_date, end_date, status, is_current)
  VALUES (
    '22222222-2222-2222-2222-222222222201',
    v_org,
    'FY ' || v_year,
    make_date(v_year, 1, 1),
    make_date(v_year, 12, 31),
    'open',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.organizations
  SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('accounting_setup_complete', true),
      currency = 'BDT'
  WHERE id = v_org;

  --------------------------------------------------------------------------
  -- Stock locations: saleable / damaged / quarantine per branch (5)
  --------------------------------------------------------------------------
  FOR r IN
    SELECT unnest(ARRAY[v_hq, v_b2, v_b3, v_b4, v_b5]) AS branch_id,
           unnest(ARRAY['HQ', 'BNG', 'JAM', 'GP', 'MTJ']) AS code
  LOOP
    INSERT INTO public.stock_locations (organization_id, branch_id, name, location_type, is_default, is_active)
    SELECT v_org, r.branch_id, r.code || ' Saleable Floor', 'saleable', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_locations sl
      WHERE sl.branch_id = r.branch_id AND sl.location_type = 'saleable' AND sl.deleted_at IS NULL
    );

    INSERT INTO public.stock_locations (organization_id, branch_id, name, location_type, is_default, is_active)
    SELECT v_org, r.branch_id, r.code || ' Damaged Bin', 'damaged', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_locations sl
      WHERE sl.branch_id = r.branch_id AND sl.location_type = 'damaged' AND sl.deleted_at IS NULL
    );

    INSERT INTO public.stock_locations (organization_id, branch_id, name, location_type, is_default, is_active)
    SELECT v_org, r.branch_id, r.code || ' Quarantine', 'quarantine', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_locations sl
      WHERE sl.branch_id = r.branch_id AND sl.location_type = 'quarantine' AND sl.deleted_at IS NULL
    );
  END LOOP;

  --------------------------------------------------------------------------
  -- Categories (8 fashion)
  --------------------------------------------------------------------------
  INSERT INTO public.categories (id, organization_id, name, code, sort_order, is_active)
  VALUES
    ('c1000000-0000-0000-0000-000000000001', v_org, 'Women''s Wear', 'WW', 10, true),
    ('c1000000-0000-0000-0000-000000000002', v_org, 'Men''s Wear', 'MW', 20, true),
    ('c1000000-0000-0000-0000-000000000003', v_org, 'Kids Wear', 'KW', 30, true),
    ('c1000000-0000-0000-0000-000000000004', v_org, 'Ethnic & Festive', 'EF', 40, true),
    ('c1000000-0000-0000-0000-000000000005', v_org, 'Accessories', 'ACC', 50, true),
    ('c1000000-0000-0000-0000-000000000006', v_org, 'Footwear', 'FW', 60, true),
    ('c1000000-0000-0000-0000-000000000007', v_org, 'Lingerie & Lounge', 'LL', 70, true),
    ('c1000000-0000-0000-0000-000000000008', v_org, 'Outerwear', 'OW', 80, true)
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Subcategories (15)
  --------------------------------------------------------------------------
  INSERT INTO public.subcategories (id, organization_id, category_id, name, code, sort_order, is_active)
  VALUES
    ('c2000000-0000-0000-0000-000000000001', v_org, 'c1000000-0000-0000-0000-000000000001', 'Kurti & Tunics', 'WW-KT', 10, true),
    ('c2000000-0000-0000-0000-000000000002', v_org, 'c1000000-0000-0000-0000-000000000001', 'Salwar Sets', 'WW-SS', 20, true),
    ('c2000000-0000-0000-0000-000000000003', v_org, 'c1000000-0000-0000-0000-000000000001', 'Dresses', 'WW-DR', 30, true),
    ('c2000000-0000-0000-0000-000000000004', v_org, 'c1000000-0000-0000-0000-000000000002', 'Casual Shirts', 'MW-CS', 10, true),
    ('c2000000-0000-0000-0000-000000000005', v_org, 'c1000000-0000-0000-0000-000000000002', 'Panjabi', 'MW-PJ', 20, true),
    ('c2000000-0000-0000-0000-000000000006', v_org, 'c1000000-0000-0000-0000-000000000003', 'Girls Frocks', 'KW-GF', 10, true),
    ('c2000000-0000-0000-0000-000000000007', v_org, 'c1000000-0000-0000-0000-000000000003', 'Boys Sets', 'KW-BS', 20, true),
    ('c2000000-0000-0000-0000-000000000008', v_org, 'c1000000-0000-0000-0000-000000000004', 'Lehenga', 'EF-LH', 10, true),
    ('c2000000-0000-0000-0000-000000000009', v_org, 'c1000000-0000-0000-0000-000000000004', 'Sharee', 'EF-SR', 20, true),
    ('c2000000-0000-0000-0000-000000000010', v_org, 'c1000000-0000-0000-0000-000000000005', 'Handbags', 'ACC-HB', 10, true),
    ('c2000000-0000-0000-0000-000000000011', v_org, 'c1000000-0000-0000-0000-000000000005', 'Jewelry', 'ACC-JW', 20, true),
    ('c2000000-0000-0000-0000-000000000012', v_org, 'c1000000-0000-0000-0000-000000000006', 'Sandals', 'FW-SD', 10, true),
    ('c2000000-0000-0000-0000-000000000013', v_org, 'c1000000-0000-0000-0000-000000000006', 'Heels', 'FW-HL', 20, true),
    ('c2000000-0000-0000-0000-000000000014', v_org, 'c1000000-0000-0000-0000-000000000007', 'Nightwear', 'LL-NW', 10, true),
    ('c2000000-0000-0000-0000-000000000015', v_org, 'c1000000-0000-0000-0000-000000000008', 'Shawls & Capes', 'OW-SC', 10, true)
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Brands (10)
  --------------------------------------------------------------------------
  INSERT INTO public.brands (id, organization_id, name, code, is_active)
  VALUES
    ('b1000000-0000-0000-0000-000000000001', v_org, 'Mahi Essentials', 'MAHI', true),
    ('b1000000-0000-0000-0000-000000000002', v_org, 'Noor Label', 'NOOR', true),
    ('b1000000-0000-0000-0000-000000000003', v_org, 'Dhaka Craft', 'DHAKA', true),
    ('b1000000-0000-0000-0000-000000000004', v_org, 'Silk Route', 'SILK', true),
    ('b1000000-0000-0000-0000-000000000005', v_org, 'Urban Rose', 'UROSE', true),
    ('b1000000-0000-0000-0000-000000000006', v_org, 'Lotus Thread', 'LOTUS', true),
    ('b1000000-0000-0000-0000-000000000007', v_org, 'Monsoon Muse', 'MONSOON', true),
    ('b1000000-0000-0000-0000-000000000008', v_org, 'Pearl & Petal', 'PEARL', true),
    ('b1000000-0000-0000-0000-000000000009', v_org, 'Breeze Co.', 'BREEZE', true),
    ('b1000000-0000-0000-0000-000000000010', v_org, 'Heritage Weave', 'HERITAGE', true)
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Products (40) â€” mix of simple + variable, realistic fashion names
  --------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE organization_id = v_org AND deleted_at IS NULL LIMIT 1) THEN
    -- 1â€“24: variable apparel (4 sizes Ã— some colors â†’ many variants)
    INSERT INTO public.products (
      id, organization_id, category_id, subcategory_id, brand_id,
      name, description, product_type, unit, base_sku,
      purchase_price, selling_price, wholesale_price, has_variants, is_active, track_inventory
    ) VALUES
      ('a1000000-0000-0000-0000-000000000001', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
       'Aarohi Cotton Kurti', 'Breathable everyday kurti with side slits', 'variable', 'pcs', 'GBM-KUR-AAR', 850, 1590, 1400, true, true, true),
      ('a1000000-0000-0000-0000-000000000002', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002',
       'Noor Linen Tunic', 'Relaxed linen tunic for warm days', 'variable', 'pcs', 'GBM-TUN-NOO', 920, 1750, 1550, true, true, true),
      ('a1000000-0000-0000-0000-000000000003', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003',
       'Teal Embroidery Salwar Set', 'Three-piece embroidered salwar set', 'variable', 'pcs', 'GBM-SAL-TEA', 1450, 2890, 2550, true, true, true),
      ('a1000000-0000-0000-0000-000000000004', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006',
       'Lotus Lawn Salwar', 'Soft lawn fabric with printed dupatta', 'variable', 'pcs', 'GBM-SAL-LOT', 1200, 2450, 2150, true, true, true),
      ('a1000000-0000-0000-0000-000000000005', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005',
       'Urban Rose Midi Dress', 'Midi length dress with belt detail', 'variable', 'pcs', 'GBM-DRS-URB', 1100, 2200, 1950, true, true, true),
      ('a1000000-0000-0000-0000-000000000006', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000007',
       'Monsoon Wrap Dress', 'Lightweight wrap dress', 'variable', 'pcs', 'GBM-DRS-MON', 980, 1990, 1750, true, true, true),
      ('a1000000-0000-0000-0000-000000000007', v_org, 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000009',
       'Breeze Oxford Shirt', 'Classic oxford casual shirt', 'variable', 'pcs', 'GBM-SHT-BRE', 750, 1490, 1300, true, true, true),
      ('a1000000-0000-0000-0000-000000000008', v_org, 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001',
       'Mahi Soft Twill Shirt', 'Soft twill everyday shirt', 'variable', 'pcs', 'GBM-SHT-MAH', 780, 1550, 1350, true, true, true),
      ('a1000000-0000-0000-0000-000000000009', v_org, 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003',
       'Dhaka Craft Panjabi', 'Handloom-inspired panjabi', 'variable', 'pcs', 'GBM-PNJ-DHA', 1050, 2150, 1900, true, true, true),
      ('a1000000-0000-0000-0000-000000000010', v_org, 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000010',
       'Heritage Embroidered Panjabi', 'Festive embroidered panjabi', 'variable', 'pcs', 'GBM-PNJ-HER', 1350, 2750, 2400, true, true, true),
      ('a1000000-0000-0000-0000-000000000011', v_org, 'c1000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000008',
       'Pearl Girl Frock', 'Party frock with tulle overlay', 'variable', 'pcs', 'GBM-FRK-PRL', 650, 1350, 1150, true, true, true),
      ('a1000000-0000-0000-0000-000000000012', v_org, 'c1000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000009',
       'Breeze Boys Twin Set', 'Shirt and pant twin set', 'variable', 'pcs', 'GBM-BOY-BRE', 700, 1450, 1250, true, true, true),
      ('a1000000-0000-0000-0000-000000000013', v_org, 'c1000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000004',
       'Silk Route Bridal Lehenga', 'Heavy bridal lehenga (sample sizes)', 'variable', 'pcs', 'GBM-LHN-SLK', 8500, 18500, 16500, true, true, true),
      ('a1000000-0000-0000-0000-000000000014', v_org, 'c1000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000010',
       'Heritage Jamdani Sharee', 'Handloom jamdani sharee (one size)', 'simple', 'pcs', 'GBM-SAR-JAM', 4200, 8900, 7800, false, true, true),
      ('a1000000-0000-0000-0000-000000000015', v_org, 'c1000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000004',
       'Silk Route Soft Silk Sharee', 'Soft silk sharee with golden border', 'simple', 'pcs', 'GBM-SAR-SSK', 3100, 6500, 5800, false, true, true),
      ('a1000000-0000-0000-0000-000000000016', v_org, 'c1000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000006',
       'Lotus Cashmere-Feel Shawl', 'Winter shawl wrap', 'variable', 'pcs', 'GBM-SHW-LOT', 900, 1850, 1600, true, true, true),
      ('a1000000-0000-0000-0000-000000000017', v_org, 'c1000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000008',
       'Pearl Soft Night Set', 'Two-piece soft nightwear', 'variable', 'pcs', 'GBM-NGT-PRL', 620, 1290, 1100, true, true, true),
      ('a1000000-0000-0000-0000-000000000018', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000007',
       'Monsoon Printed Kurti', 'Seasonal print kurti', 'variable', 'pcs', 'GBM-KUR-MON', 800, 1550, 1350, true, true, true),
      ('a1000000-0000-0000-0000-000000000019', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002',
       'Noor Party Gown', 'Floor-length party gown', 'variable', 'pcs', 'GBM-GWN-NOO', 2200, 4500, 4000, true, true, true),
      ('a1000000-0000-0000-0000-000000000020', v_org, 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000009',
       'Breeze Linen Blend Shirt', 'Breathable linen blend', 'variable', 'pcs', 'GBM-SHT-LIN', 820, 1650, 1450, true, true, true);

    -- 21â€“40: accessories, footwear, simple SKUs
    INSERT INTO public.products (
      id, organization_id, category_id, subcategory_id, brand_id,
      name, description, product_type, unit, base_sku, base_barcode,
      purchase_price, selling_price, wholesale_price, has_variants, is_active, track_inventory
    ) VALUES
      ('a1000000-0000-0000-0000-000000000021', v_org, 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000005',
       'Urban Rose Crossbody Bag', 'Daily crossbody bag', 'simple', 'pcs', 'GBM-BAG-URB', '8901000000021', 650, 1450, 1250, false, true, true),
      ('a1000000-0000-0000-0000-000000000022', v_org, 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000008',
       'Pearl Clutch Evening Bag', 'Beaded evening clutch', 'simple', 'pcs', 'GBM-BAG-PRL', '8901000000022', 480, 1100, 950, false, true, true),
      ('a1000000-0000-0000-0000-000000000023', v_org, 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000008',
       'Pearl Drop Earrings', 'Gold-tone drop earrings', 'simple', 'pcs', 'GBM-EAR-PRL', '8901000000023', 180, 450, 380, false, true, true),
      ('a1000000-0000-0000-0000-000000000024', v_org, 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000002',
       'Noor Layered Necklace', 'Layered chain necklace', 'simple', 'pcs', 'GBM-NCK-NOO', '8901000000024', 220, 550, 480, false, true, true),
      ('a1000000-0000-0000-0000-000000000025', v_org, 'c1000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000005',
       'Urban Rose Flat Sandal', 'Comfort flat sandal', 'variable', 'pcs', 'GBM-SND-URB', NULL, 550, 1190, 1050, true, true, true),
      ('a1000000-0000-0000-0000-000000000026', v_org, 'c1000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000008',
       'Pearl Block Heel', 'Stable block heel', 'variable', 'pcs', 'GBM-HEL-PRL', NULL, 780, 1650, 1450, true, true, true),
      ('a1000000-0000-0000-0000-000000000027', v_org, 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000001',
       'Mahi Structured Tote', 'Work tote bag', 'simple', 'pcs', 'GBM-TOT-MAH', '8901000000027', 720, 1590, 1400, false, true, true),
      ('a1000000-0000-0000-0000-000000000028', v_org, 'c1000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000004',
       'Silk Route Capelet', 'Festive capelet overlay', 'simple', 'pcs', 'GBM-CAP-SLK', '8901000000028', 1150, 2450, 2150, false, true, true),
      ('a1000000-0000-0000-0000-000000000029', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000006',
       'Lotus Mandarin Top', 'Mandarin collar top', 'variable', 'pcs', 'GBM-TOP-LOT', NULL, 700, 1390, 1200, true, true, true),
      ('a1000000-0000-0000-0000-000000000030', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000010',
       'Heritage Dupatta Set', 'Kurti with heritage dupatta', 'variable', 'pcs', 'GBM-DUP-HER', NULL, 980, 1990, 1750, true, true, true),
      ('a1000000-0000-0000-0000-000000000031', v_org, 'c1000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000007',
       'Monsoon Kids Romper', 'Soft romper for toddlers', 'variable', 'pcs', 'GBM-RMP-MON', NULL, 420, 890, 780, true, true, true),
      ('a1000000-0000-0000-0000-000000000032', v_org, 'c1000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000001',
       'Mahi Lounge Set', 'Matching lounge top and pant', 'variable', 'pcs', 'GBM-LNG-MAH', NULL, 680, 1390, 1200, true, true, true),
      ('a1000000-0000-0000-0000-000000000033', v_org, 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000003',
       'Dhaka Craft Bangle Pair', 'Hand-painted bangle pair', 'simple', 'pcs', 'GBM-BNG-DHA', '8901000000033', 150, 390, 330, false, true, true),
      ('a1000000-0000-0000-0000-000000000034', v_org, 'c1000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000009',
       'Breeze Slide Sandal', 'Easy slide sandal', 'variable', 'pcs', 'GBM-SLD-BRE', NULL, 400, 890, 780, true, true, true),
      ('a1000000-0000-0000-0000-000000000035', v_org, 'c1000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000002',
       'Noor Reception Lehenga', 'Light reception lehenga', 'variable', 'pcs', 'GBM-LHN-NOO', NULL, 5200, 11500, 9800, true, true, true),
      ('a1000000-0000-0000-0000-000000000036', v_org, 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000006',
       'Lotus White Panjabi', 'Crisp white cotton panjabi', 'variable', 'pcs', 'GBM-PNJ-LOT', NULL, 880, 1750, 1550, true, true, true),
      ('a1000000-0000-0000-0000-000000000037', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005',
       'Urban Rose Shirt Dress', 'Button-front shirt dress', 'variable', 'pcs', 'GBM-DRS-SHT', NULL, 950, 1890, 1650, true, true, true),
      ('a1000000-0000-0000-0000-000000000038', v_org, 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000007',
       'Monsoon Mini Backpack', 'Compact mini backpack', 'simple', 'pcs', 'GBM-BPK-MON', '8901000000038', 580, 1290, 1100, false, true, true),
      ('a1000000-0000-0000-0000-000000000039', v_org, 'c1000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000010',
       'Heritage Wool Wrap', 'Warm wool wrap', 'simple', 'pcs', 'GBM-WRP-HER', '8901000000039', 1250, 2650, 2300, false, true, true),
      ('a1000000-0000-0000-0000-000000000040', v_org, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
       'Mahi Everyday Tee Kurti', 'Soft jersey tee-style kurti', 'variable', 'pcs', 'GBM-TEE-MAH', NULL, 520, 990, 880, true, true, true);

    --------------------------------------------------------------------------
    -- Variants: variable products get size matrix; simple get one default
    --------------------------------------------------------------------------
    FOR r IN
      SELECT p.id, p.base_sku, p.purchase_price, p.selling_price, p.wholesale_price, p.product_type, p.name, p.base_barcode
      FROM public.products p
      WHERE p.organization_id = v_org AND p.deleted_at IS NULL
      ORDER BY p.base_sku
    LOOP
      IF r.product_type = 'simple' THEN
        INSERT INTO public.product_variants (
          organization_id, product_id, sku, barcode, name,
          purchase_price, selling_price, wholesale_price, is_active
        ) VALUES (
          v_org, r.id, r.base_sku || '-OS', coalesce(r.base_barcode, '89' || lpad((abs(hashtext(r.base_sku)) % 10000000000)::text, 10, '0')),
          r.name || ' / One Size',
          r.purchase_price, r.selling_price, r.wholesale_price, true
        );
      ELSE
        -- Apparel: 4 sizes Ã— 2 colors = 8 variants; footwear: 4 sizes Ã— 1 color
        IF r.base_sku LIKE 'GBM-SND%' OR r.base_sku LIKE 'GBM-HEL%' OR r.base_sku LIKE 'GBM-SLD%' THEN
          FOR i IN 1..4 LOOP
            v_sku := r.base_sku || '-' || v_sizes[i];
            v_barcode := '89' || lpad((abs(hashtext(v_sku)) % 10000000000)::text, 10, '0');
            INSERT INTO public.product_variants (
              organization_id, product_id, sku, barcode, name,
              purchase_price, selling_price, wholesale_price, is_active
            ) VALUES (
              v_org, r.id, v_sku, v_barcode,
              r.name || ' / ' || v_sizes[i],
              r.purchase_price, r.selling_price, r.wholesale_price, true
            );
          END LOOP;
        ELSE
          FOR i IN 1..4 LOOP
            FOR j IN 1..2 LOOP
              v_sku := r.base_sku || '-' || left(v_colors[j], 3) || '-' || v_sizes[i];
              v_barcode := '89' || lpad((abs(hashtext(v_sku)) % 10000000000)::text, 10, '0');
              INSERT INTO public.product_variants (
                organization_id, product_id, sku, barcode, name,
                purchase_price, selling_price, wholesale_price, is_active
              ) VALUES (
                v_org, r.id, v_sku, v_barcode,
                r.name || ' / ' || v_colors[j] || ' / ' || v_sizes[i],
                r.purchase_price, r.selling_price, r.wholesale_price, true
              );
            END LOOP;
          END LOOP;
        END IF;
      END IF;
    END LOOP;

    --------------------------------------------------------------------------
    -- Inventory balances: HQ + all branch saleable locations
    --------------------------------------------------------------------------
    INSERT INTO public.inventory_balances (organization_id, variant_id, location_id, quantity)
    SELECT
      v_org,
      pv.id,
      sl.id,
      CASE
        WHEN sl.branch_id = v_hq THEN (15 + (abs(hashtext(pv.id::text || sl.id::text)) % 35))::numeric
        ELSE (3 + (abs(hashtext(pv.id::text || sl.id::text)) % 12))::numeric
      END
    FROM public.product_variants pv
    CROSS JOIN public.stock_locations sl
    WHERE pv.organization_id = v_org
      AND sl.organization_id = v_org
      AND sl.location_type = 'saleable'
      AND sl.deleted_at IS NULL
      AND pv.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_balances ib
        WHERE ib.variant_id = pv.id AND ib.location_id = sl.id AND ib.deleted_at IS NULL
      );
  END IF;

  --------------------------------------------------------------------------
  -- Customers (30)
  --------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE organization_id = v_org AND deleted_at IS NULL LIMIT 1) THEN
    INSERT INTO public.customers (organization_id, branch_id, name, phone, email, address, district, preferred_channel, current_due, status)
    SELECT
      v_org,
      (ARRAY[v_hq, v_b2, v_b3, v_b4, v_b5])[1 + ((gs - 1) % 5)],
      (ARRAY[
        'Farzana Rahman', 'Nusrat Jahan', 'Samira Chowdhury', 'Ayesha Siddiqui', 'Ruma Akter',
        'Tahmina Begum', 'Lamia Islam', 'Sharmin Sultana', 'Nadia Khan', 'Maliha Hossain',
        'Rifat Ahmed', 'Karimullah Sheikh', 'Jannatul Ferdous', 'Sadia Afrin', 'Meherun Nesa',
        'Anika Tabassum', 'Purnima Das', 'Shila Rani', 'Ishrat Jahan', 'Tasnim Ahmed',
        'Rumana Kabir', 'Fahmida Haque', 'Nazia Sultana', 'Afroza Begum', 'Sumaiya Rahman',
        'Priya Sarker', 'Laboni Akter', 'Sanjida Islam', 'Orpita Barua', 'Mim Chowdhury'
      ])[gs],
      '0171' || lpad(gs::text, 7, '0'),
      'customer' || gs || '@example.com',
      'Road ' || gs || ', Block ' || chr(64 + ((gs - 1) % 5 + 1)),
      (ARRAY['Dhaka', 'Gazipur', 'Narayanganj', 'Chattogram', 'Sylhet'])[1 + ((gs - 1) % 5)],
      (ARRAY['store', 'facebook', 'whatsapp', 'instagram', 'phone'])[1 + ((gs - 1) % 5)],
      CASE WHEN gs % 5 = 0 THEN 1500.00 WHEN gs % 7 = 0 THEN 850.00 ELSE 0 END,
      'active'
    FROM generate_series(1, 30) AS gs;
  END IF;

  --------------------------------------------------------------------------
  -- Suppliers (20)
  --------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE organization_id = v_org AND deleted_at IS NULL LIMIT 1) THEN
    INSERT INTO public.suppliers (organization_id, branch_id, name, phone, email, address, current_due, status)
    SELECT
      v_org,
      v_hq,
      (ARRAY[
        'Mirpur Fashion House', 'Banglamotor Textiles', 'Gulshan Silk Traders', 'Old Dhaka Embroidery Co',
        'Uttara Apparel Supply', 'Chawk Bazar Yarn Hub', 'Banani Boutique Source', 'Motijheel Fabric Mart',
        'Keraniganj Knit Works', 'Tejgaon Garments Line', 'Mohakhali Accessories', 'Dhanmondi Design Mill',
        'Farmgate Leather Arts', 'Savar Cotton Depot', 'Narayanganj Weave Co', 'Tongi Packaging Plus',
        'Gazipur Thread Works', 'Ashulia Print Studio', 'Jatrabari wholesale Hub', 'Postogola Dye Works'
      ])[gs],
      '0181' || lpad(gs::text, 7, '0'),
      'supplier' || gs || '@trade.bd',
      'Warehouse Lane ' || gs || ', Dhaka',
      CASE WHEN gs % 4 = 0 THEN 25000.00 WHEN gs % 3 = 0 THEN 12000.00 ELSE 0 END,
      'active'
    FROM generate_series(1, 20) AS gs;
  END IF;

END $$;
