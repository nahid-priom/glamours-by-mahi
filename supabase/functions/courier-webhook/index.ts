// Glamourous by Mahi · Retail ERP
// Edge Function: courier-webhook
// Verifies secret header, normalizes event, upserts courier_events by external_event_id,
// creates pending courier_return_request when event type is return, returns 200.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-courier-secret, x-webhook-secret",
};

type NormalizedEvent = {
  external_event_id: string;
  event_type: string;
  organization_id: string | null;
  courier_company_id: string | null;
  parcel_id: string | null;
  tracking_no: string | null;
  consignment_id: string | null;
  occurred_at: string | null;
  courier_reason: string | null;
  payload: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEvent(raw: Record<string, unknown>): NormalizedEvent {
  const data = (raw.data as Record<string, unknown> | undefined) ?? raw;

  const external_event_id = String(
    data.external_event_id ??
      data.event_id ??
      data.id ??
      raw.external_event_id ??
      raw.event_id ??
      "",
  ).trim();

  const rawType = String(
    data.event_type ?? data.type ?? data.status ?? raw.event_type ?? "",
  )
    .trim()
    .toLowerCase();

  // Map common courier statuses into a coarse event_type
  let event_type = rawType;
  if (
    ["return", "returned", "return_initiated", "rto", "return_to_origin"].some(
      (t) => rawType.includes(t),
    )
  ) {
    event_type = "return";
  }

  return {
    external_event_id,
    event_type,
    organization_id: (data.organization_id ?? raw.organization_id ?? null) as
      | string
      | null,
    courier_company_id: (data.courier_company_id ??
      raw.courier_company_id ??
      null) as string | null,
    parcel_id: (data.parcel_id ?? raw.parcel_id ?? null) as string | null,
    tracking_no: (data.tracking_no ??
      data.tracking_number ??
      data.trackingId ??
      null) as string | null,
    consignment_id: (data.consignment_id ??
      data.consignmentId ??
      null) as string | null,
    occurred_at: (data.occurred_at ??
      data.timestamp ??
      data.event_time ??
      null) as string | null,
    courier_reason: (data.reason ?? data.courier_reason ?? null) as
      | string
      | null,
    payload: raw,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const expectedSecret = Deno.env.get("COURIER_WEBHOOK_SECRET");
    const provided =
      req.headers.get("x-courier-secret") ??
      req.headers.get("x-webhook-secret") ??
      "";

    if (!expectedSecret || provided !== expectedSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const raw = (await req.json()) as Record<string, unknown>;
    const event = normalizeEvent(raw);

    if (!event.external_event_id) {
      return jsonResponse({ error: "external_event_id required" }, 400);
    }

    // Resolve parcel / org if not provided
    let organizationId = event.organization_id;
    let courierCompanyId = event.courier_company_id;
    let parcelId = event.parcel_id;
    let saleId: string | null = null;
    let branchId: string | null = null;

    if (!parcelId && (event.tracking_no || event.consignment_id)) {
      let parcelQuery = supabase
        .from("courier_parcels")
        .select(
          "id, organization_id, courier_company_id, sale_id, branch_id, status",
        )
        .is("deleted_at", null)
        .limit(1);

      if (event.tracking_no) {
        parcelQuery = parcelQuery.eq("tracking_no", event.tracking_no);
      } else if (event.consignment_id) {
        parcelQuery = parcelQuery.eq("consignment_id", event.consignment_id);
      }

      const { data: parcel } = await parcelQuery.maybeSingle();
      if (parcel) {
        parcelId = parcel.id;
        organizationId = organizationId ?? parcel.organization_id;
        courierCompanyId = courierCompanyId ?? parcel.courier_company_id;
        saleId = parcel.sale_id;
        branchId = parcel.branch_id;
      }
    } else if (parcelId) {
      const { data: parcel } = await supabase
        .from("courier_parcels")
        .select(
          "id, organization_id, courier_company_id, sale_id, branch_id",
        )
        .eq("id", parcelId)
        .is("deleted_at", null)
        .maybeSingle();

      if (parcel) {
        organizationId = organizationId ?? parcel.organization_id;
        courierCompanyId = courierCompanyId ?? parcel.courier_company_id;
        saleId = parcel.sale_id;
        branchId = parcel.branch_id;
      }
    }

    if (!organizationId) {
      return jsonResponse(
        { error: "Unable to resolve organization_id for event" },
        400,
      );
    }

    // Upsert by external_event_id for idempotency
    const { data: upserted, error: upsertError } = await supabase
      .from("courier_events")
      .upsert(
        {
          organization_id: organizationId,
          courier_company_id: courierCompanyId,
          parcel_id: parcelId,
          external_event_id: event.external_event_id,
          event_type: event.event_type,
          payload: event.payload,
          occurred_at: event.occurred_at,
          processed_at: new Date().toISOString(),
        },
        { onConflict: "external_event_id" },
      )
      .select("id, event_type")
      .single();

    if (upsertError) {
      console.error("courier_events upsert failed", upsertError);
      return jsonResponse({ error: "Failed to persist event" }, 500);
    }

    let returnRequestId: string | null = null;

    if (event.event_type === "return" && parcelId) {
      // Avoid duplicate pending returns for same parcel+event
      const { data: existingReturn } = await supabase
        .from("courier_return_requests")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("parcel_id", parcelId)
        .eq("courier_event_id", upserted.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingReturn) {
        returnRequestId = existingReturn.id;
      } else {
        const { data: created, error: returnError } = await supabase
          .from("courier_return_requests")
          .insert({
            organization_id: organizationId,
            branch_id: branchId,
            courier_company_id: courierCompanyId,
            parcel_id: parcelId,
            sale_id: saleId,
            courier_event_id: upserted.id,
            status: "pending",
            courier_reason: event.courier_reason,
          })
          .select("id")
          .single();

        if (returnError) {
          console.error("courier_return_requests insert failed", returnError);
          // Still return 200 — event was stored; return creation can be retried/reconciled
        } else {
          returnRequestId = created.id;

          // Seed expected items from original sale when available
          if (saleId) {
            const { data: saleItems } = await supabase
              .from("sale_items")
              .select("id, variant_id, qty")
              .eq("sale_id", saleId)
              .eq("organization_id", organizationId)
              .is("deleted_at", null);

            if (saleItems?.length) {
              await supabase.from("courier_return_items").insert(
                saleItems.map((si) => ({
                  organization_id: organizationId,
                  request_id: created.id,
                  variant_id: si.variant_id,
                  sale_item_id: si.id,
                  expected_qty: si.qty,
                })),
              );
            }
          }

          await supabase
            .from("courier_parcels")
            .update({ status: "returned" })
            .eq("id", parcelId)
            .eq("organization_id", organizationId);
        }
      }
    }

    return jsonResponse({
      ok: true,
      external_event_id: event.external_event_id,
      event_id: upserted.id,
      event_type: event.event_type,
      return_request_id: returnRequestId,
    });
  } catch (err) {
    console.error("courier-webhook error", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
