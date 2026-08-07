/**
 * Edge Function: admin-reset-user-password
 * Super Admin / permitted roles set a new password for a staff user.
 *
 * Body: { user_id, new_password }
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

    const callerClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: canReset, error: permErr } = await callerClient.rpc("user_has_permission", {
      p_permission_key: "administration.users.reset_password",
    });

    let allowed = Boolean(canReset) && !permErr;
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
      return jsonResponse(
        { error: "Missing permission administration.users.reset_password" },
        403,
      );
    }

    const body = (await req.json()) as {
      user_id?: string;
      new_password?: string;
    };

    const userId = body.user_id?.trim();
    const newPassword = body.new_password ?? "";

    if (!userId || !newPassword) {
      return jsonResponse({ error: "user_id and new_password are required" }, 400);
    }
    if (newPassword.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", callerData.user.id)
      .maybeSingle();

    const orgId = callerProfile?.organization_id;
    if (!orgId) {
      return jsonResponse({ error: "Caller organization not found" }, 400);
    }

    const { data: target } = await admin
      .from("profiles")
      .select("id, organization_id, email, username, is_active")
      .eq("id", userId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!target) {
      return jsonResponse({ error: "User not found in your organization" }, 404);
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateErr) {
      return jsonResponse({ error: updateErr.message }, 400);
    }

    await admin.rpc("write_audit_log", {
      p_organization_id: orgId,
      p_branch_id: null,
      p_actor_id: callerData.user.id,
      p_action: "admin.user.reset_password",
      p_entity_type: "profile",
      p_entity_id: userId,
      p_before_data: null,
      p_after_data: {
        username: target.username,
        email: target.email,
        reset_by: callerData.user.id,
      },
      p_reason: null,
      p_request_meta: { source: "admin-reset-user-password" },
    });

    return jsonResponse({
      user_id: userId,
      ok: true,
    });
  } catch (e) {
    console.error("admin-reset-user-password error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
