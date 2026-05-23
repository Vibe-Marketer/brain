/**
 * composio-trigger-webhook — @composio-unverified
 *
 * Single webhook ingress for Composio-routed triggers. Phase B scaffold
 * normalizers cover gong / dialpad / webex; additional toolkits (Microsoft
 * Teams, Google Meet, Fireflies-via-Composio, etc.) are planned per ADR-006
 * but not yet implemented in `normalizeByToolkit`. Composio posts a signed
 * payload per trigger event; this function:
 *
 *   1. Reads the `webhook-signature` (or `x-composio-signature`) header.
 *   2. Verifies HMAC-SHA256 against COMPOSIO_WEBHOOK_SECRET.
 *   3. Routes the payload to a per-toolkit normalizer.
 *   4. Pushes the canonical recording through `runCanonicalConnectorPipeline`.
 *
 * Status: SCAFFOLD. The exact trigger event names and payload structure
 * vary per toolkit. Verify against the live Composio Triggers documentation
 * before adopting any specific source.
 *
 * Security posture (mirrors fireflies-webhook):
 *   - Reject missing signature → 401.
 *   - Reject unmatched connected_account_id → 200 (per ADR-006: avoid
 *     leaking which accounts CallVault tracks; Composio retries on non-2xx).
 *   - Reject tampered signature → 401.
 *   - Reject normalizer payload-shape errors → 200 ignored. A malformed
 *     vendor payload is NOT retriable — returning 5xx would create an
 *     infinite Composio retry loop on bad data.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyComposioSignature } from "../_shared/composio-client.ts";
import { runCanonicalConnectorPipeline } from "../_shared/recording-connectors.ts";
import {
  gongCallToCanonical,
  type GongCallPayload,
} from "../_shared/composio-normalizers/gong.ts";
import {
  dialpadCallToCanonical,
  type DialpadCallPayload,
} from "../_shared/composio-normalizers/dialpad.ts";
import {
  webexRecordingToCanonical,
  type WebexRecordingPayload,
} from "../_shared/composio-normalizers/webex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-signature, x-composio-signature",
};

interface ComposioTriggerEnvelope {
  trigger_slug?: string;
  toolkit?: string;
  connected_account_id?: string;
  payload?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("COMPOSIO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error(
        "[composio-trigger-webhook] COMPOSIO_WEBHOOK_SECRET not configured",
      );
      return jsonResponse({ error: "Webhook secret not configured" }, 503);
    }

    const rawBody = await req.text();
    const signature =
      req.headers.get("webhook-signature") ||
      req.headers.get("x-composio-signature") ||
      "";

    if (!signature) {
      return jsonResponse({ error: "Missing webhook-signature header" }, 401);
    }

    const isValid = await verifyComposioSignature(
      rawBody,
      signature,
      webhookSecret,
    );
    if (!isValid) {
      return jsonResponse({ error: "Invalid webhook signature" }, 401);
    }

    let envelope: ComposioTriggerEnvelope;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Webhook body must be JSON" }, 400);
    }

    if (!envelope.connected_account_id) {
      return jsonResponse(
        { error: "Webhook envelope missing connected_account_id" },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up by the dedicated column (denormalized + uniquely indexed in
    // 20260523192117_composio_integration_ids.sql). Querying the JSONB blob
    // bypasses the unique index and lets two rows collide silently.
    const { data: matchingSource, error: lookupError } = await supabase
      .from("import_sources")
      .select(
        "id, user_id, source_app, connection_metadata, composio_connected_account_id",
      )
      .eq("composio_connected_account_id", envelope.connected_account_id)
      .eq("is_active", true)
      .maybeSingle();

    if (lookupError) {
      console.error("[composio-trigger-webhook] lookup error:", lookupError);
      return jsonResponse({ error: lookupError.message }, 500);
    }

    if (!matchingSource) {
      // Per fireflies-webhook precedent: return 200 to prevent retry storms
      // and avoid leaking which accounts CallVault knows about.
      console.warn(
        "[composio-trigger-webhook] no matching source for connected_account_id",
        {
          connected_account_id: envelope.connected_account_id,
        },
      );
      return jsonResponse({ success: true, ignored: true, reason: "no_match" });
    }

    const toolkit = (
      envelope.toolkit ??
      matchingSource.source_app ??
      ""
    ).toLowerCase();

    // H3: Wrap normalizer call in its own try/catch. Normalizers throw on
    // missing required fields (`gong.metaData.id`, `dialpad.call.date_started`,
    // `webex.recording.id`/`meeting.id`). Without this guard a malformed
    // payload propagates to the outer catch → HTTP 500 → Composio retries
    // forever. Log a redacted breadcrumb; NEVER log envelope.payload (PII).
    let canonical;
    try {
      canonical = normalizeByToolkit(toolkit, envelope);
    } catch (normalizerError) {
      const message =
        normalizerError instanceof Error
          ? normalizerError.message
          : "unknown normalizer error";
      console.error("[composio-trigger-webhook] normalizer failed", {
        toolkit,
        trigger_slug: envelope.trigger_slug ?? null,
        connected_account_id: envelope.connected_account_id,
        message,
      });
      return jsonResponse({
        success: true,
        ignored: true,
        reason: "normalizer_failed",
      });
    }

    if (!canonical) {
      console.warn("[composio-trigger-webhook] no normalizer for toolkit", {
        toolkit,
      });
      return jsonResponse({
        success: true,
        ignored: true,
        reason: "no_normalizer",
      });
    }

    const result = await runCanonicalConnectorPipeline(
      supabase,
      matchingSource.user_id,
      canonical,
      {
        importSource: `composio-${toolkit}`,
        includeRawPayload: true,
      },
    );

    // H4: status update was previously fire-and-forget — if it failed the
    // row's last_sync_at would stay stale and any prior error_message would
    // stay stuck. Continue returning the pipeline result to Composio either
    // way (recording is already persisted by runCanonicalConnectorPipeline).
    const { error: statusUpdateError } = await supabase
      .from("import_sources")
      .update({
        last_sync_at: new Date().toISOString(),
        error_message:
          result.success || result.skipped
            ? null
            : (result.error ?? "Composio webhook import failed"),
      })
      .eq("id", matchingSource.id)
      .eq("user_id", matchingSource.user_id);

    if (statusUpdateError) {
      console.error(
        "[composio-trigger-webhook] failed to update import_sources status",
        {
          import_source_id: matchingSource.id,
          user_id: matchingSource.user_id,
          message: statusUpdateError.message,
        },
      );
    }

    // M3: emit a console.error breadcrumb when the pipeline reports failure
    // so aggregated alerting picks it up. The DB-side error_message is
    // operator-facing; this is the log-aggregator signal.
    if (!result.success && !result.skipped) {
      console.error("[composio-trigger-webhook] pipeline failed", {
        import_source_id: matchingSource.id,
        user_id: matchingSource.user_id,
        toolkit,
        error: result.error ?? null,
      });
    }

    return jsonResponse({
      success: result.success,
      skipped: result.skipped ?? false,
      recordingId: result.recordingId ?? null,
    });
  } catch (error) {
    console.error("[composio-trigger-webhook] error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

function normalizeByToolkit(
  toolkit: string,
  envelope: ComposioTriggerEnvelope,
) {
  if (!envelope.payload || typeof envelope.payload !== "object") return null;
  // L3: don't mutate the caller-provided envelope.payload — clone so the
  // connected_account_id we stamp here never leaks into upstream callers or
  // future retry inspection.
  const payload: Record<string, unknown> = {
    ...(envelope.payload as Record<string, unknown>),
  };
  if (envelope.connected_account_id) {
    payload["connected_account_id"] = envelope.connected_account_id;
  }

  if (toolkit === "gong")
    return gongCallToCanonical(payload as GongCallPayload);
  if (toolkit === "dialpad")
    return dialpadCallToCanonical(payload as DialpadCallPayload);
  if (toolkit === "webex")
    return webexRecordingToCanonical(payload as WebexRecordingPayload);
  return null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
