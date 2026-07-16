-- Seed Super Admin: mahi@codebondhu.com
-- Creates auth user + profile + branch access (idempotent).

DO $$
DECLARE
  v_user_id uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
  v_email text := 'mahi@codebondhu.com';
  v_password text := 'codebondhu004';
  v_org_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_super_admin_role_id uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc2';
  v_default_branch_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(v_email)) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Mahi Rahman'),
      timezone('utc', now()),
      timezone('utc', now()),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      v_user_id::text,
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    );
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role_id,
    default_branch_id,
    is_active
  ) VALUES (
    v_user_id,
    v_org_id,
    'Mahi Rahman',
    v_email,
    v_super_admin_role_id,
    v_default_branch_id,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role_id = EXCLUDED.role_id,
    default_branch_id = EXCLUDED.default_branch_id,
    is_active = EXCLUDED.is_active,
    deleted_at = NULL,
    updated_at = timezone('utc', now());

  INSERT INTO public.user_branch_access (organization_id, user_id, branch_id)
  SELECT v_org_id, v_user_id, b.id
  FROM public.branches b
  WHERE b.organization_id = v_org_id
    AND b.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_branch_access uba
      WHERE uba.user_id = v_user_id
        AND uba.branch_id = b.id
        AND uba.deleted_at IS NULL
    );
END $$;
