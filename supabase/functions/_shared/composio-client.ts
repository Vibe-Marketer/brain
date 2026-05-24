/**
 * Composio API client — @composio-unverified
 *
 * Thin Deno-runtime wrapper around composio.dev REST endpoints. Used by
 * `composio-oauth-callback` (auth) and `composio-trigger-webhook` (ingress)
 * once Phase B ships and `COMPOSIO_API_KEY` is provisioned.
 *
 * Status: SCAFFOLD. None of these methods have been exercised against a
 * live Composio account. Endpoint paths reflect Composio's documented API
 * shape as of May 2026; verify against current docs before production use:
 *   https://docs.composio.dev/docs/triggers
 *   https://docs.composio.dev/toolkits
 *
 * Reviewers: if you change a method name or endpoint, also update the
 * corresponding caller in composio-oauth-callback or composio-trigger-webhook.
 */

const COMPOSIO_BASE_URL =
  Deno.env.get("COMPOSIO_BASE_URL") ?? "https://backend.composio.dev/api/v3";

export interface ComposioClientConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ComposioConnectedAccount {
  id: string;
  toolkitSlug: string;
  status: "INITIATED" | "ACTIVE" | "INACTIVE" | "EXPIRED" | "FAILED";
  ownerId?: string;
  metadata?: Record<string, unknown>;
}

export interface ComposioOAuthInitiateResponse {
  connectedAccountId: string;
  authUrl: string;
}

export interface ComposioToolCallResponse<T = unknown> {
  data?: T;
  error?: string;
  successful: boolean;
}

export type ComposioErrorKind =
  | "auth"
  | "rate_limit"
  | "not_found"
  | "validation"
  | "upstream"
  | "unknown";

/**
 * Structured error thrown by `ComposioClient.request`. Holds both a
 * developer-facing `upstreamMessage` (logged at console.error) and a
 * curated `userMessage` safe to surface in a toast or 5xx response body.
 * Internal endpoint paths and Composio-side request IDs never appear in
 * `userMessage`.
 */
export class ComposioApiError extends Error {
  readonly status: number;
  readonly kind: ComposioErrorKind;
  readonly code: string | null;
  readonly upstreamMessage: string;
  readonly userMessage: string;

  constructor(init: {
    status: number;
    kind: ComposioErrorKind;
    code: string | null;
    upstreamMessage: string;
    userMessage: string;
  }) {
    super(init.upstreamMessage);
    this.name = "ComposioApiError";
    this.status = init.status;
    this.kind = init.kind;
    this.code = init.code;
    this.upstreamMessage = init.upstreamMessage;
    this.userMessage = init.userMessage;
  }
}

export function classifyComposioStatus(status: number): ComposioErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  if (status >= 400 && status < 500) return "validation";
  if (status >= 500) return "upstream";
  return "unknown";
}

function userMessageForKind(kind: ComposioErrorKind): string {
  switch (kind) {
    case "auth":
      return "Composio rejected the request — reconnect the integration.";
    case "rate_limit":
      return "Composio rate-limited the request — try again shortly.";
    case "not_found":
      return "The Composio resource was not found.";
    case "validation":
      return "Composio rejected the request payload.";
    case "upstream":
      return "Composio is temporarily unavailable — try again shortly.";
    default:
      return "Composio returned an unexpected error.";
  }
}

export class ComposioClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ComposioClientConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error("[composio-client] COMPOSIO_API_KEY is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? COMPOSIO_BASE_URL;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * Initiate an OAuth connection for `toolkitSlug`. Composio returns an
   * auth URL the user opens to authorize the integration. Once they
   * authorize, Composio fires a callback to our `composio-oauth-callback`
   * function with the resulting `connectedAccountId`.
   *
   * @composio-unverified
   */
  async initiateOAuth(
    toolkitSlug: string,
    callbackUrl: string,
    userId: string,
  ): Promise<ComposioOAuthInitiateResponse> {
    const response = await this.request<ComposioOAuthInitiateResponse>(
      "POST",
      "/connected_accounts/initiate",
      {
        toolkit_slug: toolkitSlug,
        callback_url: callbackUrl,
        user_id: userId,
      },
    );
    return response;
  }

  /**
   * Look up a connected account by id. Used to verify a webhook delivery
   * matches an account CallVault knows about.
   *
   * @composio-unverified
   */
  async getConnectedAccount(
    connectedAccountId: string,
  ): Promise<ComposioConnectedAccount> {
    return this.request<ComposioConnectedAccount>(
      "GET",
      `/connected_accounts/${encodeURIComponent(connectedAccountId)}`,
    );
  }

  /**
   * Disconnect a Composio integration. Idempotent.
   *
   * @composio-unverified
   */
  async deleteConnectedAccount(connectedAccountId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/connected_accounts/${encodeURIComponent(connectedAccountId)}`,
    );
  }

  /**
   * Execute a Composio tool (action) against a connected account. Used by
   * polling-based adapters (Gong, tl;dv — both have zero triggers).
   *
   * @composio-unverified
   */
  async executeTool<T = unknown>(
    toolSlug: string,
    connectedAccountId: string,
    input: Record<string, unknown>,
  ): Promise<ComposioToolCallResponse<T>> {
    return this.request<ComposioToolCallResponse<T>>(
      "POST",
      "/actions/execute",
      {
        tool_slug: toolSlug,
        connected_account_id: connectedAccountId,
        input,
      },
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body == null ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const kind = classifyComposioStatus(response.status);
      const upstreamMessage =
        readErrorMessage(payload) ??
        `Composio API ${method} ${path} failed with HTTP ${response.status}`;
      const code = readErrorCode(payload);
      // Developer trace stays in logs; never returned to clients.
      console.error("[composio-client]", {
        method,
        path,
        status: response.status,
        kind,
        code,
        upstreamMessage,
      });
      throw new ComposioApiError({
        status: response.status,
        kind,
        code,
        upstreamMessage,
        userMessage: userMessageForKind(kind),
      });
    }

    return payload as T;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // L6: surface a truncated breadcrumb when the upstream response body
    // wasn't JSON; full text stays out of return so callers don't leak it.
    console.error(
      "[composio-client] non-JSON response body (truncated):",
      text.slice(0, 200),
    );
    return text;
  }
}

function readErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.code === "string") return obj.code;
  if (typeof obj.error_code === "string") return obj.error_code;
  return null;
}

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (typeof obj.message === "string") return obj.message;
  return null;
}

/**
 * Verifies a Composio webhook delivery signature. Composio signs the raw
 * request body with the workspace's webhook secret using HMAC-SHA256 and
 * sends the hex digest in the `webhook-signature` header.
 *
 * @composio-unverified — verify the exact header name + signature format
 * against composio.dev's current trigger documentation before relying on
 * this in production. Some Composio docs show `webhook-signature`, others
 * show `x-composio-signature`. The webhook function accepts either.
 */
export async function verifyComposioSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const expected = await computeHmacHex(rawBody, secret);
  const provided = signatureHeader.replace(/^sha256=/, "").trim();
  return timingSafeEqual(expected, provided);
}

async function computeHmacHex(
  rawBody: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
