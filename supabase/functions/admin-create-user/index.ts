/**
 * Edge Function: admin-create-user
 * Create staff from an Employee with username + password (Supabase Auth).
 * Never stores plain-text passwords in app tables.
 *
 * Body: {
 *   employee_id, role_id, username, password,
 *   default_branch_id?, branch_ids?, email?
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidUsername(u: string): boolean {
  return /^[a-z0-9._-]{3,40}$/.test(u);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: callerData, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !callerData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: canCreate, error: permErr } = await callerClient.rpc("user_has_permission", {
      p_permission_key: "administration.users.create",
    });

    let allowed = Boolean(canCreate) && !permErr;
    if (!allowed) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role_id, roles(name)")
        .eq("id", callerData.user.id)
        .maybeSingle();
      const roleName = (profile as { roles?: { name?: string } | null } | null)?.roles?.name;
      allowed = roleName === "Super Admin" || roleName === "Owner";
    }

    if (!allowed) {
      return jsonResponse({ error: "Missing permission administration.users.create" }, 403);
    }

    const body = (await req.json()) as {
      employee_id?: string;
      role_id?: string;
      username?: string;
      password?: string;
      default_branch_id?: string;
      branch_ids?: string[];
      email?: string;
      organization_id?: string;
    };

    const employeeId = body.employee_id?.trim();
    const roleId = body.role_id?.trim();
    const username = normalizeUsername(body.username ?? "");
    const password = body.password ?? "";

    if (!employeeId || !roleId || !username || !password) {
      return jsonResponse(
        { error: "employee_id, role_id, username and password are required" },
        400,
      );
    }
    if (!isValidUsername(username)) {
      return jsonResponse(
        { error: "Username must be 3–40 chars: letters, numbers, . _ -" },
        400,
      );
    }
    if (password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", callerData.user.id)
      .maybeSingle();

    const orgId = body.organization_id ?? callerProfile?.organization_id;
    if (!orgId) {
      return jsonResponse({ error: "organization_id could not be resolved" }, 400);
    }

    const { data: org } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .maybeSingle();
    const orgSlug = (org?.slug as string | undefined) || "org";

    const { data: employee, error: empErr } = await admin
      .from("employees")
      .select("id, full_name, email, phone, profile_id, status, organization_id, branch_id")
      .eq("id", employeeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (empErr || !employee) {
      return jsonResponse({ error: "Employee not found in your organization" }, 404);
    }
    if (employee.profile_id) {
      return jsonResponse({ error: "Employee already has a linked user account" }, 400);
    }
    if (employee.status === "terminated") {
      return jsonResponse({ error: "Cannot create login for terminated employee" }, 400);
    }

    const { data: existingUser } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("username", username)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingUser) {
      return jsonResponse({ error: "Username already taken in this organization" }, 400);
    }

    const employeeEmail = (employee.email as string | null)?.trim().toLowerCase() || null;
    const overrideEmail = body.email?.trim().toLowerCase() || null;
    const authEmail =
      overrideEmail ||
      employeeEmail ||
      `${username}@${orgSlug}.staff.local`;

    const fullName = (employee.full_name as string).trim();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
        organization_id: orgId,
        employee_id: employeeId,
      },
    });

    if (createErr) {
      return jsonResponse({ error: createErr.message }, 400);
    }

    const userId = created.user?.id;
    if (!userId) {
      return jsonResponse({ error: "User created but id missing" }, 500);
    }

    const defaultBranchId =
      body.default_branch_id ?? (employee.branch_id as string | null) ?? null;

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      organization_id: orgId,
      full_name: fullName,
      email: authEmail,
      username,
      phone: (employee.phone as string | null) ?? null,
      role_id: roleId,
      default_branch_id: defaultBranchId,
      is_active: true,
      created_by: callerData.user.id,
      updated_by: callerData.user.id,
    });

    if (profileErr) {
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({ error: profileErr.message }, 500);
    }

    // Race-safe link: only when still unlinked. On failure, compensate Auth user.
    const { data: linkedRows, error: linkErr } = await admin
      .from("employees")
      .update({
        profile_id: userId,
        updated_by: callerData.user.id,
      })
      .eq("id", employeeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .is("profile_id", null)
      .select("id");

    if (linkErr || !linkedRows?.length) {
      console.error("employee link failed", linkErr?.message ?? "already linked or missing");
      await admin.from("profiles").update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_by: callerData.user.id,
      }).eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({
        error: linkErr
          ? "User created but employee link failed: " + linkErr.message
          : "Employee was linked by another request; auth user rolled back",
      }, 409);
    }

    // Align active rule subjects with login profile (config, not historical amounts)
    const { error: rulesSyncErr } = await admin
      .from("salesman_commission_rules")
      .update({
        profile_id: userId,
        updated_by: callerData.user.id,
      })
      .eq("employee_id", employeeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (rulesSyncErr) {
      console.error("commission rules profile sync failed", rulesSyncErr.message);
    }

    // Fill null profile_id on existing ledger rows only — never rewrite amounts/attribution
    const { error: ledgerSyncErr } = await admin
      .from("salesman_commissions")
      .update({
        profile_id: userId,
        updated_by: callerData.user.id,
        needs_employee_link: false,
      })
      .eq("employee_id", employeeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .is("profile_id", null);

    if (ledgerSyncErr) {
      console.error("commission ledger profile sync failed", ledgerSyncErr.message);
    }

    const branchIds = Array.from(
      new Set(
        [
          ...(body.branch_ids ?? []),
          defaultBranchId,
        ].filter((id): id is string => Boolean(id)),
      ),
    );

    const branchWarnings: string[] = [];
    for (const branchId of branchIds) {
      // Revive soft-deleted grant if present
      const { data: revived, error: reviveErr } = await admin
        .from("user_branch_access")
        .update({
          deleted_at: null,
          updated_by: callerData.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("branch_id", branchId)
        .eq("organization_id", orgId)
        .not("deleted_at", "is", null)
        .select("id");

      if (reviveErr) {
        console.error("user_branch_access revive failed", reviveErr.message);
        branchWarnings.push(branchId);
        continue;
      }
      if (revived?.length) continue;

      const { error: branchErr } = await admin.from("user_branch_access").insert({
        user_id: userId,
        branch_id: branchId,
        organization_id: orgId,
        created_by: callerData.user.id,
        updated_by: callerData.user.id,
      });
      if (branchErr) {
        // Unique conflict = already granted
        if (!/duplicate|unique/i.test(branchErr.message)) {
          console.error("user_branch_access insert failed", branchErr.message);
          branchWarnings.push(branchId);
        }
      }
    }

    await admin.rpc("write_audit_log", {
      p_organization_id: orgId,
      p_branch_id: defaultBranchId,
      p_actor_id: callerData.user.id,
      p_action: "admin.user.create",
      p_entity_type: "profile",
      p_entity_id: userId,
      p_before_data: null,
      p_after_data: {
        email: authEmail,
        username,
        full_name: fullName,
        role_id: roleId,
        employee_id: employeeId,
        branch_ids: branchIds,
        branch_grant_warnings: branchWarnings,
      },
      p_reason: null,
      p_request_meta: { source: "admin-create-user" },
    });

    return jsonResponse({
      user_id: userId,
      email: authEmail,
      username,
      full_name: fullName,
      employee_id: employeeId,
      created: true,
      branch_ids: branchIds,
      warnings: branchWarnings.length
        ? [`Branch grant incomplete for: ${branchWarnings.join(", ")}`]
        : [],
    });
  } catch (e) {
    console.error("admin-create-user error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
