/**
 * sentry-webhook — receives Sentry Integration Platform `event_alert` webhooks,
 * authenticates them via HMAC over the RAW body, maps level→severity, derives a
 * dedup fingerprint from issue_id, and delegates the atomic write to the
 * `ingest_sentry_ticket` SECURITY DEFINER RPC.
 *
 * Trust boundary: Internet → this function. The POST body is UNTRUSTED. No DB
 * work happens before the signature gate passes. No Supabase JWT is required on
 * this path (gateway exemption: config.toml [functions.sentry-webhook]
 * verify_jwt = false) — do NOT import _shared/auth.ts here.
 *
 * SEN-01 / SEN-02 (Phase 12).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqualString } from "../_shared/webhook-signing.ts";
import {
  deriveFingerprint,
  issueAlertSchema,
  mapSeverity,
  tagValue,
  verifySentrySignature,
} from "./lib.ts";

// Server-to-server webhook: wildcard origin (Sentry calls from arbitrary IPs,
// not a browser). Advertise the Sentry hook headers so any preflight passes.
const WEBHOOK_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, sentry-trace, baggage, sentry-hook-signature, sentry-hook-timestamp, sentry-hook-resource",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = {
  ...WEBHOOK_CORS_HEADERS,
  "Content-Type": "application/json",
};

const MAX_BODY_BYTES = 512 * 1024; // 512KB DoS guard

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

Deno.serve(async (req) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: WEBHOOK_CORS_HEADERS });
  }

  // 2. Method gate
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  // 3. Size guard (Content-Length first; rawBody.length re-checked below)
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "payload too large" }, 413);
  }

  try {
    // 4. Read RAW body FIRST (signature is computed over exactly these bytes).
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return json({ error: "payload too large" }, 413);
    }

    const signatureHeader = req.headers.get("sentry-hook-signature") ?? "";
    const secret = Deno.env.get("SENTRY_WEBHOOK_SECRET") ?? "";

    // 4a. Signature gate — ZERO DB work before this passes.
    //
    // Fallback (signature-unavailable): if SENTRY_WEBHOOK_SECRET is configured
    // with a `qp:` prefix, authenticate via a `?secret=<value>` query param
    // (constant-time compared) instead of HMAC. Primary path is HMAC.
    let authenticated = false;
    if (secret.startsWith("qp:")) {
      const expected = secret.slice(3);
      const provided = new URL(req.url).searchParams.get("secret") ?? "";
      authenticated = expected.length > 0 &&
        timingSafeEqualString(expected, provided);
    } else if (secret) {
      authenticated = await verifySentrySignature(
        rawBody,
        signatureHeader,
        secret,
      );
    }

    if (!authenticated) {
      // Generic body — never echo the secret or computed digest.
      return json({ error: "invalid signature" }, 401);
    }

    // 5. Fast-ACK non-event_alert resources so Sentry never disables the hook.
    const resource = req.headers.get("sentry-hook-resource");
    if (resource && resource !== "event_alert") {
      return json({ ignored: true, resource }, 200);
    }

    // 6. Parse + validate.
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const validation = issueAlertSchema.safeParse(parsedJson);
    if (!validation.success) {
      return json(
        { error: validation.error.errors[0]?.message ?? "invalid payload" },
        400,
      );
    }
    const payload = validation.data;
    const ev = payload.data.event;

    const fingerprint = deriveFingerprint(payload);
    if (!fingerprint) {
      return json({ error: "missing issue_id" }, 400);
    }
    const severity = mapSeverity(ev.level);

    // 7. Context jsonb (RESEARCH.md "Context jsonb shape").
    const context = {
      sentry: {
        issue_id: String(ev.issue_id),
        issue_url: `https://ai-simple.sentry.io/issues/${String(ev.issue_id)}/`,
        api_issue_url: ev.issue_url ?? null,
        web_url: ev.web_url ?? null,
        title: ev.title ?? null,
        culprit: ev.culprit ?? null,
        level: ev.level ?? null,
        release: ev.release ?? null,
        platform: ev.platform ?? null,
        environment: tagValue(ev.tags, "environment"),
        first_seen_event_id: ev.event_id ?? null,
        project: "call-vault",
        triggered_rule: payload.data.triggered_rule ?? null,
      },
    };

    const title = (ev.title ?? "Sentry issue").slice(0, 200);
    const notifyBody = `${ev.culprit ?? "unknown location"} — Sentry occurrence`
      .slice(0, 500);

    // 8. Single RPC round-trip (atomic upsert + audit + notify).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("ingest_sentry_ticket", {
      p_fingerprint: fingerprint,
      p_severity: severity,
      p_context: context,
      p_notify_title: `Sentry: ${title}`,
      p_notify_body: notifyBody,
    });

    if (error) {
      console.error("ingest_sentry_ticket failed:", error.message);
      // 500 → Sentry retries.
      return json({ error: "ingestion failed" }, 500);
    }

    // RETURNS TABLE → supabase-js yields an array of rows.
    const row = Array.isArray(data) ? data[0] : data;

    // 9. Fast success.
    return json({
      success: true,
      ticket_id: row?.ticket_id ?? null,
      occurrence_count: row?.occurrence_count ?? null,
      created: row?.created ?? null,
    }, 200);
  } catch (error) {
    console.error(
      "sentry-webhook error:",
      error instanceof Error ? error.message : "unknown",
    );
    return json({ error: "internal error" }, 500);
  }
});
