-- Glamourous by Mahi · HR & Payroll demo seed
-- Populates employees, devices, attendance, leave, and payroll for demo / QA.
-- Idempotent via ON CONFLICT (id) DO NOTHING.

DO $$
DECLARE
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_hq  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_b2  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  v_b3  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';
  v_b4  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4';
  v_b5  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5';

  v_dev_hq  uuid := '77d7d7d7-d7d7-47d7-8d7d-d7d7d7010001';
  v_dev_bng uuid := '77d7d7d7-d7d7-47d7-8d7d-d7d7d7010002';
  v_dev_jam uuid := '77d7d7d7-d7d7-47d7-8d7d-d7d7d7010003';

  v_pay_jun uuid := '77f7f7f7-f7f7-47f7-8f7f-f7f7f7010001';
  v_pay_jul uuid := '77f7f7f7-f7f7-47f7-8f7f-f7f7f7010002';

  v_emp uuid;
  v_branch uuid;
  v_day int;
  v_work date;
  v_status text;
  v_first_in timestamptz;
  v_last_out timestamptz;
  v_rec_id uuid;
  v_gross numeric(14, 2);
  v_deductions numeric(14, 2);
  v_net numeric(14, 2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE EXCEPTION 'Base organization seed missing; run supabase/seed.sql first';
  END IF;

  --------------------------------------------------------------------------
  -- Employees (12 across branches; mix of departments and statuses)
  --------------------------------------------------------------------------
  INSERT INTO public.employees (
    id, organization_id, branch_id, employee_code, full_name, phone, email,
    department, designation, shift_name, joining_date, employment_type, salary_type,
    basic_salary, allowances, bank_details, emergency_contact, status, notes
  )
  VALUES
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001', v_org, v_hq,  'EMP-001', 'Rahim Ahmed',      '01630000001', 'rahim@glamourousbymahi.com',      'Sales',     'Store Manager',     'Morning',   '2023-01-15', 'full_time', 'monthly', 35000, '{"house_rent":5000,"transport":2000}'::jsonb, '{"bank":"DBBL","account":"1234567890"}'::jsonb, '{"name":"Sultana Ahmed","phone":"01711111111"}'::jsonb, 'active',     'HQ flagship lead'),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', v_org, v_b2,  'EMP-002', 'Fatima Begum',     '01630000002', 'fatima@glamourousbymahi.com',     'Sales',     'Floor Supervisor',  'Morning',   '2023-04-01', 'full_time', 'monthly', 28000, '{"house_rent":3000}'::jsonb, '{"bank":"BRAC","account":"2234567890"}'::jsonb, '{"name":"Abdul Karim","phone":"01722222222"}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003', v_org, v_b2,  'EMP-003', 'Karim Hossain',    '01630000003', 'karim@glamourousbymahi.com',      'Sales',     'Sales Associate',   'Morning',   '2024-02-10', 'full_time', 'monthly', 20000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004', v_org, v_b3,  'EMP-004', 'Nusrat Jahan',     '01630000004', 'nusrat@glamourousbymahi.com',     'Sales',     'Sales Associate',   'Evening',   '2024-05-20', 'full_time', 'monthly', 20000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000005', v_org, v_hq,  'EMP-005', 'Sakib Hasan',      '01630000005', 'sakib@glamourousbymahi.com',      'Accounts',  'Accountant',        'Morning',   '2022-11-01', 'full_time', 'monthly', 32000, '{"medical":1500}'::jsonb, '{"bank":"City Bank","account":"3234567890"}'::jsonb, '{}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000006', v_org, v_hq,  'EMP-006', 'Ayesha Siddique',  '01630000006', 'ayesha@glamourousbymahi.com',     'HR',        'HR Executive',      'Morning',   '2023-08-12', 'full_time', 'monthly', 30000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000007', v_org, v_b4,  'EMP-007', 'Tanvir Islam',     '01630000007', 'tanvir@glamourousbymahi.com',     'Sales',     'Sales Associate',   'Morning',   '2024-09-01', 'full_time', 'monthly', 18000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000008', v_org, v_b5,  'EMP-008', 'Maliha Rahman',    '01630000008', 'maliha@glamourousbymahi.com',     'Sales',     'Cashier',           'Morning',   '2024-10-15', 'full_time', 'monthly', 19000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000009', v_org, v_hq,  'EMP-009', 'Imran Khan',       '01630000009', 'imran@glamourousbymahi.com',      'Warehouse', 'Warehouse Officer', 'Morning',   '2023-03-22', 'full_time', 'monthly', 22000, '{"transport":1500}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'active',     NULL),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000010', v_org, v_b2,  'EMP-010', 'Sadia Islam',      '01630000010', 'sadia@glamourousbymahi.com',      'Sales',     'Sales Associate',   'Evening',   '2025-01-05', 'part_time', 'monthly', 15000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'active',     'Part-time weekend cover'),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000011', v_org, v_b3,  'EMP-011', 'Rafiul Karim',     '01630000011', 'rafiul@glamourousbymahi.com',     'Sales',     'Sales Associate',   'Morning',   '2024-01-10', 'full_time', 'monthly', 20000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'inactive',   'On extended leave without pay'),
    ('77e7e7e7-e7e7-47e7-8e7e-e7e7e7000012', v_org, v_hq,  'EMP-012', 'Nadia Chowdhury',  '01630000012', 'nadia@glamourousbymahi.com',      'IT',        'System Support',    'Morning',   '2022-06-01', 'contract',  'monthly', 25000, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'terminated', 'Contract ended')
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Attendance devices
  --------------------------------------------------------------------------
  INSERT INTO public.attendance_devices (
    id, organization_id, branch_id, name, provider, serial_number, timezone, is_active, last_sync_at
  )
  VALUES
    (v_dev_hq,  v_org, v_hq,  'HQ Main Entrance',      'webhook', 'ZK-HQ-001',  'Asia/Dhaka', true, timezone('utc', now()) - interval '2 hours'),
    (v_dev_bng, v_org, v_b2,  'Bashundhara City Gate', 'webhook', 'ZK-BNG-002', 'Asia/Dhaka', true, timezone('utc', now()) - interval '1 hour'),
    (v_dev_jam, v_org, v_b3,  'Jamuna Park Counter',   'manual',  NULL,         'Asia/Dhaka', true, NULL)
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Device mappings
  --------------------------------------------------------------------------
  INSERT INTO public.employee_device_mappings (
    id, organization_id, employee_id, device_id, device_user_id, is_active
  )
  VALUES
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010001', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001', v_dev_hq,  '1001', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010002', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', v_dev_bng, '1002', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010003', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003', v_dev_bng, '1003', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010004', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004', v_dev_jam, '1004', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010005', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000005', v_dev_hq,  '1005', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010006', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000006', v_dev_hq,  '1006', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010007', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000007', v_dev_bng, '1007', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010008', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000008', v_dev_jam, '1008', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010009', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000009', v_dev_hq,  '1009', true),
    ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7010010', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000010', v_dev_bng, '1010', true)
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Sample raw punch logs
  --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance_raw_logs
    WHERE organization_id = v_org AND external_event_id = 'demo-punch-1001-in'
  ) THEN
    INSERT INTO public.attendance_raw_logs (
      id, organization_id, device_id, device_user_id, employee_id,
      punched_at, punch_type, external_event_id, processing_status, processed_at
    )
    VALUES
      ('77b7b7b7-b7b7-47b7-8b7b-b7b7b7010001', v_org, v_dev_hq,  '1001', '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001', timezone('utc', now()) - interval '1 day' + time '03:30', 'in',  'demo-punch-1001-in',  'processed', timezone('utc', now())),
      ('77b7b7b7-b7b7-47b7-8b7b-b7b7b7010002', v_org, v_dev_hq,  '1001', '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001', timezone('utc', now()) - interval '1 day' + time '12:00', 'out', 'demo-punch-1001-out', 'processed', timezone('utc', now())),
      ('77b7b7b7-b7b7-47b7-8b7b-b7b7b7010003', v_org, v_dev_bng, '1002', '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', timezone('utc', now()) - interval '1 day' + time '03:45', 'in',  'demo-punch-1002-in',  'processed', timezone('utc', now())),
      ('77b7b7b7-b7b7-47b7-8b7b-b7b7b7010004', v_org, v_dev_bng, '1002', '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', timezone('utc', now()) - interval '1 day' + time '12:15', 'out', 'demo-punch-1002-out', 'processed', timezone('utc', now()));
  END IF;

  --------------------------------------------------------------------------
  -- Daily attendance summaries (last 14 days, active employees 1–10)
  --------------------------------------------------------------------------
  FOR v_day IN 0..13 LOOP
    v_work := (timezone('Asia/Dhaka', now()))::date - v_day;

    FOR v_emp, v_branch IN
      SELECT e.id, e.branch_id
      FROM public.employees e
      WHERE e.id IN (
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000005',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000006',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000007',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000008',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000009',
        '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000010'
      )
      ORDER BY e.employee_code
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.attendance_records ar
        WHERE ar.employee_id = v_emp
          AND ar.work_date = v_work
          AND ar.deleted_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      v_rec_id := gen_random_uuid();

      IF extract(dow FROM v_work) = 5 THEN
        v_status := 'weekly_off';
        v_first_in := NULL;
        v_last_out := NULL;
      ELSIF v_emp = '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003'::uuid AND v_work = DATE '2026-07-10' THEN
        v_status := 'leave';
        v_first_in := NULL;
        v_last_out := NULL;
      ELSIF v_emp = '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000007'::uuid AND v_day = 2 THEN
        v_status := 'absent';
        v_first_in := NULL;
        v_last_out := NULL;
      ELSIF v_emp = '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000010'::uuid AND v_day IN (1, 8) THEN
        v_status := 'half_day';
        v_first_in := (v_work + time '10:00') AT TIME ZONE 'Asia/Dhaka';
        v_last_out := (v_work + time '14:00') AT TIME ZONE 'Asia/Dhaka';
      ELSE
        v_status := CASE
          WHEN v_day = 0 AND v_emp = '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004'::uuid THEN 'missing_checkout'
          ELSE 'present'
        END;
        v_first_in := (v_work + time '09:30' + make_interval(mins => (v_day % 5) * 3)) AT TIME ZONE 'Asia/Dhaka';
        IF v_status = 'missing_checkout' THEN
          v_last_out := NULL;
        ELSE
          v_last_out := (v_work + time '18:00' + make_interval(mins => (v_day % 4) * 5)) AT TIME ZONE 'Asia/Dhaka';
        END IF;
      END IF;

      INSERT INTO public.attendance_records (
        id, organization_id, employee_id, branch_id, work_date, status,
        first_in, last_out, late_minutes, early_leave_minutes, working_minutes,
        overtime_minutes, is_approved, notes
      )
      VALUES (
        v_rec_id,
        v_org,
        v_emp,
        v_branch,
        v_work,
        v_status,
        v_first_in,
        v_last_out,
        CASE WHEN v_status = 'present' AND (v_day % 7) = 0 THEN 12 ELSE 0 END,
        CASE WHEN v_status = 'half_day' THEN 240 ELSE 0 END,
        CASE
          WHEN v_status = 'present' THEN 510
          WHEN v_status = 'half_day' THEN 240
          ELSE 0
        END,
        CASE WHEN v_status = 'present' AND v_day IN (3, 6) THEN 30 ELSE 0 END,
        v_status IN ('present', 'half_day', 'weekly_off'),
        CASE WHEN v_status = 'missing_checkout' THEN 'Checkout not recorded on device' ELSE NULL END
      );
    END LOOP;
  END LOOP;

  --------------------------------------------------------------------------
  -- Leave requests
  --------------------------------------------------------------------------
  INSERT INTO public.leave_requests (
    id, organization_id, employee_id, leave_type, start_date, end_date, days,
    reason, status, reviewed_at
  )
  VALUES
    ('77c7c7c7-c7c7-47c7-8c7c-c7c7c7010001', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003', 'sick',      '2026-07-10', '2026-07-10', 1,   'Fever — doctor advised rest', 'approved', timezone('utc', now()) - interval '14 days'),
    ('77c7c7c7-c7c7-47c7-8c7c-c7c7c7010002', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000007', 'casual',    '2026-08-01', '2026-08-02', 2,   'Family event in Sylhet',      'pending',  NULL),
    ('77c7c7c7-c7c7-47c7-8c7c-c7c7c7010003', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000005', 'annual',    '2026-07-20', '2026-07-22', 3,   'Eid vacation travel',         'rejected', timezone('utc', now()) - interval '3 days'),
    ('77c7c7c7-c7c7-47c7-8c7c-c7c7c7010004', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', 'casual',    '2026-07-28', '2026-07-28', 0.5, 'Half-day personal work',      'approved', timezone('utc', now()) - interval '1 day'),
    ('77c7c7c7-c7c7-47c7-8c7c-c7c7c7010005', v_org, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000008', 'maternity', '2026-09-01', '2026-11-30', 90,  'Maternity leave application', 'pending',  NULL)
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Payroll runs
  --------------------------------------------------------------------------
  INSERT INTO public.payroll_runs (
    id, organization_id, branch_id, period_label, period_start, period_end,
    status, total_gross, total_deductions, total_net, approved_at, paid_at, notes
  )
  VALUES
    (
      v_pay_jun, v_org, NULL, 'June 2026', '2026-06-01', '2026-06-30',
      'paid', 0, 0, 0,
      '2026-07-05 10:00:00+00', '2026-07-07 14:30:00+00',
      'Demo payroll — all active staff paid via bank transfer'
    ),
    (
      v_pay_jul, v_org, NULL, 'July 2026', '2026-07-01', '2026-07-31',
      'draft', 0, 0, 0, NULL, NULL,
      'Current month payroll — draft awaiting attendance lock'
    )
  ON CONFLICT (id) DO NOTHING;

  --------------------------------------------------------------------------
  -- Payroll items — June 2026 (paid)
  --------------------------------------------------------------------------
  INSERT INTO public.payroll_items (
    id, organization_id, payroll_run_id, employee_id,
    basic_salary, allowances, overtime, bonus,
    attendance_deduction, leave_deduction, other_deductions, net_salary, breakdown
  )
  VALUES
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020001', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001', 35000, 7000, 2500, 0,    0,   0, 200, 44300, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020002', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', 28000, 3000, 0,    1500, 0,   0, 200, 32300, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020003', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003', 20000, 0,    0,    0,    0,   0, 200, 19800, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020004', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004', 20000, 0,    0,    0,    0,   0, 200, 19800, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020005', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000005', 32000, 1500, 0,    0,    0,   0, 200, 33300, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020006', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000006', 30000, 0,    0,    0,    0,   0, 200, 29800, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020007', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000007', 18000, 0,    0,    0,    500, 0, 200, 17300, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020008', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000008', 19000, 0,    0,    0,    0,   0, 200, 18800, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020009', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000009', 22000, 1500, 0,    0,    0,   0, 200, 23300, '{"period":"2026-06","pf_employee":200}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7020010', v_org, v_pay_jun, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000010', 15000, 0,    0,    0,    300, 0, 200, 14500, '{"period":"2026-06","pf_employee":200}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  SELECT
    COALESCE(SUM(basic_salary + allowances + overtime + bonus), 0),
    COALESCE(SUM(attendance_deduction + leave_deduction + other_deductions), 0),
    COALESCE(SUM(net_salary), 0)
  INTO v_gross, v_deductions, v_net
  FROM public.payroll_items
  WHERE payroll_run_id = v_pay_jun
    AND deleted_at IS NULL;

  UPDATE public.payroll_runs
  SET total_gross = v_gross,
      total_deductions = v_deductions,
      total_net = v_net
  WHERE id = v_pay_jun;

  --------------------------------------------------------------------------
  -- Payroll items — July 2026 (draft preview)
  --------------------------------------------------------------------------
  INSERT INTO public.payroll_items (
    id, organization_id, payroll_run_id, employee_id,
    basic_salary, allowances, overtime, bonus,
    attendance_deduction, leave_deduction, other_deductions, net_salary, breakdown
  )
  VALUES
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7030001', v_org, v_pay_jul, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001', 35000, 7000, 0, 0, 0, 0, 0, 42000, '{"period":"2026-07","status":"draft"}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7030002', v_org, v_pay_jul, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', 28000, 3000, 0, 0, 0, 0, 0, 31000, '{"period":"2026-07","status":"draft"}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7030003', v_org, v_pay_jul, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003', 20000, 0,    0, 0, 0, 0, 0, 20000, '{"period":"2026-07","status":"draft"}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7030004', v_org, v_pay_jul, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004', 20000, 0,    0, 0, 0, 0, 0, 20000, '{"period":"2026-07","status":"draft"}'::jsonb),
    ('77f7f7f7-f7f7-47f7-8f7f-f7f7f7030005', v_org, v_pay_jul, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000005', 32000, 1500, 0, 0, 0, 0, 0, 33500, '{"period":"2026-07","status":"draft"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  SELECT
    COALESCE(SUM(basic_salary + allowances + overtime + bonus), 0),
    COALESCE(SUM(attendance_deduction + leave_deduction + other_deductions), 0),
    COALESCE(SUM(net_salary), 0)
  INTO v_gross, v_deductions, v_net
  FROM public.payroll_items
  WHERE payroll_run_id = v_pay_jul
    AND deleted_at IS NULL;

  UPDATE public.payroll_runs
  SET total_gross = v_gross,
      total_deductions = v_deductions,
      total_net = v_net
  WHERE id = v_pay_jul;

END $$;
