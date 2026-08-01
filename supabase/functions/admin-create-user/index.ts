/**
 * Edge Function: admin-create-user
 * Invite staff via Supabase Auth Admin API (service role). Never stores plain-text passwords.
 *
 * Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Body: { email, full_name, role_id?, default_branch_id?, branch_ids?, organization_id }
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

    // Permission check must run as the caller (not service role), so auth.uid() resolves.
    const callerClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: canCreate, error: permErr } = await callerClient.rpc("user_has_permission", {
      p_permission_key: "administration.users.create",
    });

    // Fallback: Super Admin / Owner via role name when RPC is unavailable under anon key.
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
      email?: string;
      full_name?: string;
      role_id?: string;
      default_branch_id?: string;
      branch_ids?: string[];
      organization_id?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const fullName = body.full_name?.trim();
    if (!email || !fullName) {
      return jsonResponse({ error: "email and full_name are required" }, 400);
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

    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName, organization_id: orgId },
        redirectTo: `${Deno.env.get("APP_URL") ?? supabaseUrl}/admin/login`,
      },
    );

    if (inviteErr) {
      return jsonResponse({ error: inviteErr.message }, 400);
    }

    const userId = inviteData.user?.id;
    if (!userId) {
      return jsonResponse({ error: "Invite succeeded but user id missing" }, 500);
    }

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      organization_id: orgId,
      full_name: fullName,
      email,
      role_id: body.role_id ?? null,
      default_branch_id: body.default_branch_id ?? null,
      is_active: true,
      created_by: callerData.user.id,
      updated_by: callerData.user.id,
    });

    if (profileErr) {
      return jsonResponse({ error: profileErr.message }, 500);
    }

    if (body.branch_ids?.length) {
      const rows = body.branch_ids.map((branchId) => ({
        user_id: userId,
        branch_id: branchId,
        organization_id: orgId,
        created_by: callerData.user.id,
        updated_by: callerData.user.id,
      }));
      const { error: branchErr } = await admin.from("user_branch_access").upsert(rows, {
        onConflict: "user_id,branch_id",
      });
      if (branchErr) {
        // Partial unique index may not support onConflict; insert individually.
        for (const row of rows) {
          await admin.from("user_branch_access").insert(row);
        }
      }
    }

    await admin.rpc("write_audit_log", {
      p_organization_id: orgId,
      p_branch_id: body.default_branch_id ?? null,
      p_actor_id: callerData.user.id,
      p_action: "admin.user.invite",
      p_entity_type: "profile",
      p_entity_id: userId,
      p_before_data: null,
      p_after_data: { email, full_name: fullName, role_id: body.role_id ?? null },
      p_reason: null,
      p_request_meta: { source: "admin-create-user" },
    });

    return jsonResponse({
      user_id: userId,
      email,
      full_name: fullName,
      invited: true,
    });
  } catch (e) {
    console.error("admin-create-user error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
