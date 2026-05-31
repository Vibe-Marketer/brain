import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { authenticateRequest } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchFirefliesUser } from "../_shared/fireflies-connector.ts";
import {
  getDecryptedFirefliesSourceForUser,
  storeEncryptedFirefliesCredentials,
} from "../_shared/fireflies-credentials.ts";
import {
  getRequestedWorkspaceId,
  updateConnectorWorkspaceBinding,
  validateRequestedWorkspaceId,
} from "../_shared/connector-function-utils.ts";

// Fireflies API keys are alphanumeric UUID-like tokens (length seen in the
// wild: 36 chars). We accept 24-128 chars of printable ASCII to avoid being
// brittle if Fireflies changes the format; the call to fetchFirefliesUser()
// below is the authoritative check.
const SaveSourceSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(24, "Fireflies API key looks too short")
    .max(128, "Fireflies API key looks too long")
    .regex(/^[\x20-\x7E]+$/, "Fireflies API key contains invalid characters")
    .nullable()
    .optional(),
  webhookSigningSecret: z.string().trim().min(8).max(256).nullable().optional(),
  webhookPathToken: z
    .string()
    .trim()
    .regex(/^ffwh_[a-f0-9]{32}$/)
    .nullable()
    .optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
});

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authResult = await authenticateRequest(
      req,
      supabase as any,
      corsHeaders,
    );
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const rawBody = await req.json();
    const parsed = SaveSourceSchema.safeParse(rawBody);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => issue.message)
        .join("; ");
      return new Response(
        JSON.stringify({
          error: message || "Invalid Fireflies credentials payload",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const submittedApiKey =
      normalizeFirefliesApiKey(parsed.data.apiKey ?? null) || null;
    const submittedWebhookSigningSecret =
      parsed.data.webhookSigningSecret?.trim() || null;
    const submittedWebhookPathToken =
      parsed.data.webhookPathToken?.trim() || null;
    const requestedWorkspaceId = getRequestedWorkspaceId(parsed.data);
    const workspaceId = await validateRequestedWorkspaceId(
      supabase as any,
      userId,
      requestedWorkspaceId,
      corsHeaders,
    );
    if (workspaceId instanceof Response) return workspaceId;

    const { data: existing } = await (supabase as any)
      .from("import_sources")
      .select("id, account_email, webhook_path_token, workspace_id")
      .eq("user_id", userId)
      .eq("source_app", "fireflies")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existingCredentials = existing?.id
      ? await getDecryptedFirefliesSourceForUser(supabase as any, userId)
      : null;

    const apiKey = submittedApiKey ?? existingCredentials?.api_key ?? null;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Fireflies API key is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const firefliesUser = submittedApiKey
      ? await fetchFirefliesUser(submittedApiKey)
      : null;
    const accountEmail =
      firefliesUser?.email?.trim() || existing?.account_email || null;

    const generatedWebhookSigningSecret =
      !submittedWebhookSigningSecret &&
      !existingCredentials?.webhook_signing_secret
        ? generateWebhookSigningSecret()
        : null;
    const webhookSigningSecret =
      submittedWebhookSigningSecret ??
      existingCredentials?.webhook_signing_secret ??
      generatedWebhookSigningSecret;

    if (!webhookSigningSecret) {
      return new Response(
        JSON.stringify({
          error: "Fireflies webhook signing secret is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const generatedWebhookPathToken =
      !submittedWebhookPathToken && !existing?.webhook_path_token
        ? generateWebhookPathToken()
        : null;
    const webhookPathToken =
      submittedWebhookPathToken ??
      existing?.webhook_path_token ??
      generatedWebhookPathToken;

    if (!webhookPathToken) {
      return new Response(
        JSON.stringify({ error: "Fireflies webhook URL token is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stored = await storeEncryptedFirefliesCredentials(supabase as any, {
      existingSourceId: existing?.id ? String(existing.id) : null,
      userId,
      accountEmail,
      apiKey,
      webhookSigningSecret,
      webhookPathToken,
      workspaceId,
    });
    await updateConnectorWorkspaceBinding({
      supabase: supabase as any,
      userId,
      sourceId: stored.id,
      workspaceId,
    });

    const { data: sourceRow, error: readError } = await (supabase as any)
      .from("import_sources")
      .select(
        "id, user_id, source_app, account_email, is_active, last_sync_at, error_message, workspace_id, connection_metadata, webhook_path_token, created_at, updated_at",
      )
      .eq("id", stored.id)
      .eq("user_id", userId)
      .single();
    if (readError) throw readError;

    return new Response(
      JSON.stringify({
        success: true,
        source: sourceRow,
        webhookSigningSecret:
          generatedWebhookSigningSecret ??
          submittedWebhookSigningSecret ??
          undefined,
        webhookPathToken,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error saving Fireflies source:", error);
    return new Response(
      JSON.stringify({
        error: describeUnknownError(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function normalizeFirefliesApiKey(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^Bearer\s+/i, "").trim();
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown; error?: unknown }).message ??
      (error as { message?: unknown; error?: unknown }).error;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown Fireflies save error";
    }
  }
  return "Unknown Fireflies save error";
}

function generateWebhookSigningSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateWebhookPathToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `ffwh_${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
