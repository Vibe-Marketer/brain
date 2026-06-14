/**
 * sentry-resolve — daemon-only Sentry issue resolution write-back.
 *
 * Trust boundary: service-role daemon → this function → live Sentry org.
 * Supabase gateway JWT verification stays enabled for this function, then this
 * handler pins authorization to the daemon service-role bearer via
 * constant-time comparison. No user/admin JWT is accepted.
 *
 * SEN-05 (Phase 21).
 */
import { timingSafeEqualString } from "../_shared/webhook-signing.ts";
import {
  buildResolveUrl,
  RESOLVE_BODY,
  resolveInputSchema,
} from "./lib.ts";

const RESOLVE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = {
  ...RESOLVE_CORS_HEADERS,
  "Content-Type": "application/json",
};

const MAX_BODY_BYTES = 16 * 1024;

type SentryResolveEnv = {
  get(name: string): string | undefined;
};

type SentryResolveOptions = {
  env?: SentryResolveEnv;
  fetch?: typeof fetch;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";
  return token.length > 0 ? token : null;
}

function isServiceRoleBearer(req: Request, serviceRoleKey: string): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  return timingSafeEqualString(token, serviceRoleKey);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

export async function handleSentryResolveRequest(
  req: Request,
  options: SentryResolveOptions = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: RESOLVE_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "payload too large" }, 413);
  }

  const token = bearerToken(req);
  if (!token) {
    return json({ error: "missing authorization" }, 401);
  }

  const env = options.env ?? Deno.env;
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return json({ error: "resolve not configured" }, 503);
  }
  if (!isServiceRoleBearer(req, serviceRoleKey)) {
    return json({ error: "forbidden" }, 403);
  }

  const sentryOrg = env.get("SENTRY_ORG");
  const sentryToken = env.get("SENTRY_AUTH_TOKEN");
  if (!sentryOrg || !sentryToken) {
    return json({ error: "resolve not configured" }, 503);
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return json({ error: "payload too large" }, 413);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid json" }, 400);
    }

    const validation = resolveInputSchema.safeParse(parsedJson);
    if (!validation.success) {
      return json(
        { error: validation.error.errors[0]?.message ?? "invalid payload" },
        400,
      );
    }

    const url = buildResolveUrl(sentryOrg, validation.data.issue_id);
    const resolveFetch = options.fetch ?? fetch;
    const sentryResponse = await resolveFetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${sentryToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(RESOLVE_BODY),
    });

    if (sentryResponse.ok) {
      return json({ success: true, resolved: true }, 200);
    }

    if (sentryResponse.status >= 500) {
      return json({ error: "sentry retryable error" }, 503);
    }

    return json({ error: "sentry resolve failed" }, 502);
  } catch (error) {
    console.error("sentry-resolve error:", errorMessage(error));
    return json({ error: "internal error" }, 500);
  }
}

Deno.serve((req) => handleSentryResolveRequest(req));
