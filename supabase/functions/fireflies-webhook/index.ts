import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchFirefliesTranscript,
  firefliesTranscriptToCanonical,
} from "../_shared/fireflies-connector.ts";
import {
  getDecryptedFirefliesSourceByPathToken,
  type DecryptedFirefliesCredentials,
} from "../_shared/fireflies-credentials.ts";
import { runCanonicalConnectorPipeline } from "../_shared/recording-connectors.ts";
import {
  computeHmacSha256Signature,
  timingSafeEqualString,
} from "../_shared/webhook-signing.ts";

interface FirefliesWebhookEvent {
  event?: string;
  eventType?: string;
  timestamp?: number;
  meeting_id?: string;
  meetingId?: string;
  client_reference_id?: string;
}

// Server-to-server webhook — keep the wildcard origin (Fireflies calls us from
// arbitrary IPs, not a browser), but echo the same Allow-Headers list that the
// rest of our edge functions advertise so sentry-trace/baggage headers from
// any future Fireflies retry tooling are accepted.
const WEBHOOK_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, sentry-trace, baggage, x-hub-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: WEBHOOK_CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawBody = await req.text();
    const signature =
      req.headers.get("X-Hub-Signature") ||
      req.headers.get("x-hub-signature") ||
      "";
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing X-Hub-Signature header" }),
        {
          status: 401,
          headers: {
            ...WEBHOOK_CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const webhookPathToken = extractWebhookPathToken(req.url);
    if (!webhookPathToken) {
      return new Response(
        JSON.stringify({ error: "Missing Fireflies webhook URL token" }),
        {
          status: 404,
          headers: {
            ...WEBHOOK_CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const matchedSource = await findMatchingSourceByPathToken(
      supabase as any,
      rawBody,
      signature,
      webhookPathToken,
    );
    if (!matchedSource || !matchedSource.api_key) {
      return new Response(
        JSON.stringify({
          error: "No matching Fireflies webhook secret configured",
        }),
        {
          status: 401,
          headers: {
            ...WEBHOOK_CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const payload = JSON.parse(rawBody) as FirefliesWebhookEvent;
    const eventName = payload.event ?? payload.eventType ?? null;
    const meetingId = payload.meeting_id ?? payload.meetingId ?? null;

    await recordWebhookReceipt(supabase as any, matchedSource, {
      rawBody,
      signature,
      payload,
      status: "verified",
      message: "Fireflies webhook signature verified",
    });

    if (!meetingId) {
      await recordWebhookReceipt(supabase as any, matchedSource, {
        rawBody,
        signature,
        payload,
        status: "verified_no_meeting_id",
        message:
          "Fireflies webhook verified. No meeting ID was included, so no recording was imported.",
      });
      return new Response(JSON.stringify({
        success: true,
        verified: true,
        testReceived: true,
        message:
          "Webhook received and signature verified. No meeting ID was included.",
      }), {
        headers: {
          ...WEBHOOK_CORS_HEADERS,
          "Content-Type": "application/json",
        },
      });
    }
    if (
      eventName !== "meeting.transcribed" &&
      eventName !== "meeting.summarized"
    ) {
      await recordWebhookReceipt(supabase as any, matchedSource, {
        rawBody,
        signature,
        payload,
        status: "ignored",
        message: `Fireflies webhook verified and ignored: ${eventName ?? "unknown event"}`,
      });
      return new Response(
        JSON.stringify({
          success: true,
          ignored: true,
          verified: true,
          event: eventName,
        }),
        {
          headers: {
            ...WEBHOOK_CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const transcript = await fetchFirefliesTranscript(
      matchedSource.api_key,
      meetingId,
    );
    const canonical = firefliesTranscriptToCanonical(transcript);
    const result = await runCanonicalConnectorPipeline(
      supabase,
      matchedSource.user_id,
      canonical,
      {
        importSource: "fireflies-webhook",
        includeRawPayload: true,
      },
    );

    await supabase
      .from("import_sources")
      .update({
        last_sync_at: new Date().toISOString(),
        error_message:
          result.success || result.skipped
            ? null
            : (result.error ?? "Webhook import failed"),
      })
      .eq("id", matchedSource.id)
      .eq("user_id", matchedSource.user_id);

    return new Response(
      JSON.stringify({
        success: result.success,
        skipped: result.skipped ?? false,
        recordingId: result.recordingId ?? null,
      }),
      {
        headers: {
          ...WEBHOOK_CORS_HEADERS,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Fireflies webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...WEBHOOK_CORS_HEADERS,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

async function recordWebhookReceipt(
  supabase: ReturnType<typeof createClient>,
  source: DecryptedFirefliesCredentials,
  receipt: {
    rawBody: string;
    signature: string;
    payload: FirefliesWebhookEvent;
    status: string;
    message: string;
  },
) {
  const receivedAt = new Date().toISOString();
  const eventName = receipt.payload.event ?? receipt.payload.eventType ?? null;
  const meetingId = receipt.payload.meeting_id ?? receipt.payload.meetingId ?? null;

  const { data: row, error: readError } = await (supabase as any)
    .from("import_sources")
    .select("connection_metadata")
    .eq("id", source.id)
    .eq("user_id", source.user_id)
    .maybeSingle();

  if (readError) {
    console.error("Failed to read Fireflies webhook metadata:", readError);
    return;
  }

  const currentMetadata =
    row?.connection_metadata &&
    typeof row.connection_metadata === "object" &&
    !Array.isArray(row.connection_metadata)
      ? row.connection_metadata
      : {};

  const nextMetadata = {
    ...currentMetadata,
    firefliesWebhook: {
      lastReceivedAt: receivedAt,
      lastVerifiedAt: receivedAt,
      lastStatus: receipt.status,
      lastMessage: receipt.message,
      lastEvent: eventName,
      lastMeetingId: meetingId,
      lastPayloadKeys: Object.keys(receipt.payload ?? {}).sort(),
      lastSignaturePrefix: receipt.signature.slice(0, 16),
      lastBodySize: receipt.rawBody.length,
    },
  };

  const { error: updateError } = await (supabase as any)
    .from("import_sources")
    .update({
      connection_metadata: nextMetadata,
      error_message: null,
      updated_at: receivedAt,
    })
    .eq("id", source.id)
    .eq("user_id", source.user_id);

  if (updateError) {
    console.error("Failed to record Fireflies webhook receipt:", updateError);
  }
}

async function findMatchingSourceByPathToken(
  supabase: ReturnType<typeof createClient>,
  rawBody: string,
  actualSignature: string,
  webhookPathToken: string,
): Promise<DecryptedFirefliesCredentials | null> {
  const source = await getDecryptedFirefliesSourceByPathToken(
    supabase,
    webhookPathToken,
  );
  if (!source?.webhook_signing_secret) return null;
  const expected = await computeHmacSha256Signature(
    rawBody,
    source.webhook_signing_secret,
  );
  return timingSafeEqualString(expected, actualSignature) ? source : null;
}

function extractWebhookPathToken(requestUrl: string): string | null {
  const pathname = new URL(requestUrl).pathname;
  const match = pathname.match(/\/fireflies-webhook\/(ffwh_[a-f0-9]{32})\/?$/);
  return match?.[1] ?? null;
}
