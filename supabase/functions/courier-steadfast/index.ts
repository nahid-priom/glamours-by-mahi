/**
 * Edge Function: courier-steadfast
 * Steadfast Courier API proxy — secrets never exposed to browser.
 *
 * Required secrets: STEADFAST_API_KEY, STEADFAST_SECRET_KEY, STEADFAST_BASE_URL
 * Optional: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for sync logging)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SteadfastAction = "testConnection" | "createParcel" | "getStatus";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function steadfastConfig() {
  const apiKey = Deno.env.get("STEADFAST_API_KEY") ?? "";
  const secretKey = Deno.env.get("STEADFAST_SECRET_KEY") ?? "";
  const baseUrl = (Deno.env.get("STEADFAST_BASE_URL") ?? "https://portal.packzy.com/api/v1")
    .replace(/\/$/, "");
  return { apiKey, secretKey, baseUrl };
}

async function steadfastFetch(path: string, init: RequestInit = {}) {
  const { apiKey, secretKey, baseUrl } = steadfastConfig();
  if (!apiKey || !secretKey) {
    throw new Error("Steadfast API credentials are not configured in Edge Function secrets.");
  }

  const headers = new Headers(init.headers);
  headers.set("Api-Key", apiKey);
  headers.set("Secret-Key", secretKey);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : `Steadfast API error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function logSync(
  supabase: ReturnType<typeof createClient> | null,
  meta: {
    organization_id?: string;
    courier_company_id?: string;
    action: string;
    success: boolean;
    request_meta?: Record<string, unknown>;
    response_meta?: Record<string, unknown>;
    error_message?: string;
    created_by?: string;
  },
) {
  if (!supabase || !meta.organization_id) return;
  await supabase.from("courier_sync_logs").insert({
    organization_id: meta.organization_id,
    courier_company_id: meta.courier_company_id ?? null,
    provider_id: "steadfast",
    action: meta.action,
    request_meta: meta.request_meta ?? {},
    response_meta: meta.response_meta ?? {},
    success: meta.success,
    error_message: meta.error_message ?? null,
    created_by: meta.created_by ?? null,
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
  const supabase =
    supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  try {
    const body = (await req.json()) as {
      action?: SteadfastAction;
      organization_id?: string;
      courier_company_id?: string;
      created_by?: string;
      payload?: Record<string, unknown>;
    };

    const action = body.action;
    if (!action) {
      return jsonResponse({ error: "action is required" }, 400);
    }

    if (action === "testConnection") {
      try {
        await steadfastFetch("/get_balance", { method: "GET" });
        await logSync(supabase, {
          organization_id: body.organization_id,
          courier_company_id: body.courier_company_id,
          action: "testConnection",
          success: true,
          created_by: body.created_by,
        });
        return jsonResponse({ ok: true, message: "Steadfast connection successful." });
      } catch (e) {
        const msg = (e as Error).message;
        await logSync(supabase, {
          organization_id: body.organization_id,
          courier_company_id: body.courier_company_id,
          action: "testConnection",
          success: false,
          error_message: msg,
          created_by: body.created_by,
        });
        return jsonResponse({ ok: false, message: msg }, 400);
      }
    }

    const payload = body.payload ?? {};

    if (action === "createParcel") {
      const reqBody = {
        invoice: payload.merchantOrderId ?? payload.invoice,
        recipient_name: payload.recipientName,
        recipient_phone: payload.recipientPhone,
        recipient_address: payload.recipientAddress,
        cod_amount: payload.codAmount ?? 0,
        note: payload.note ?? "",
      };

      const data = (await steadfastFetch("/create_order", {
        method: "POST",
        body: JSON.stringify(reqBody),
      })) as Record<string, unknown>;

      const consignment = (data.consignment as Record<string, unknown> | undefined) ?? data;
      const trackingCode = String(
        consignment.tracking_code ?? consignment.trackingCode ?? consignment.invoice ?? "",
      );

      await logSync(supabase, {
        organization_id: body.organization_id,
        courier_company_id: body.courier_company_id,
        action: "createParcel",
        success: true,
        request_meta: reqBody as Record<string, unknown>,
        response_meta: data,
        created_by: body.created_by,
      });

      return jsonResponse({
        externalConsignmentId: String(consignment.consignment_id ?? consignment.id ?? trackingCode),
        trackingCode,
        status: "booked",
        raw: data,
      });
    }

    if (action === "getStatus") {
      const trackingCode = String(payload.trackingCode ?? payload.tracking_no ?? "");
      if (!trackingCode) {
        return jsonResponse({ error: "trackingCode is required" }, 400);
      }

      const data = (await steadfastFetch(
        `/status_by_trackingcode/${encodeURIComponent(trackingCode)}`,
        { method: "GET" },
      )) as Record<string, unknown>;

      const deliveryStatus = String(
        (data.delivery_status as string | undefined) ??
          (data.status as string | undefined) ??
          "unknown",
      );

      await logSync(supabase, {
        organization_id: body.organization_id,
        courier_company_id: body.courier_company_id,
        action: "getStatus",
        success: true,
        request_meta: { trackingCode },
        response_meta: data,
        created_by: body.created_by,
      });

      return jsonResponse({
        trackingCode,
        status: deliveryStatus.toLowerCase(),
        statusLabel: deliveryStatus,
        updatedAt: (data.updated_at as string | null) ?? null,
        raw: data,
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("courier-steadfast error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
