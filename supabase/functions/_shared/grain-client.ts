export const GRAIN_API_BASE = "https://api.grain.com";
export const GRAIN_PUBLIC_API_VERSION = "2025-10-31";
export const GRAIN_AUTHORIZE_URL = "https://grain.com/_/public-api/oauth2/authorize";
export const GRAIN_TOKEN_URL = "https://api.grain.com/_/public-api/oauth2/token";

export interface GrainTokenResponse {
  token_type?: string | null;
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
}

export interface GrainListRecordingsParams {
  token: string;
  cursor?: string | null;
  afterDateTime?: string | null;
  beforeDateTime?: string | null;
  titleSearch?: string | null;
  include?: GrainRecordingInclude;
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

export interface GrainRecordingInclude {
  highlights?: boolean;
  participants?: boolean;
  ai_action_items?: boolean;
  ai_summary?: boolean;
  private_notes?: boolean;
  calendar_event?: boolean;
  hubspot?: boolean;
}

export type GrainHookType =
  | "recording_added"
  | "recording_updated"
  | "recording_deleted"
  | "highlight_added"
  | "highlight_updated"
  | "highlight_deleted"
  | "story_added"
  | "story_updated"
  | "story_deleted"
  | "upload_status";

export interface GrainHook {
  id: string;
  enabled?: boolean;
  hook_url?: string;
  hook_type?: GrainHookType;
  include?: Record<string, unknown>;
  inserted_at?: string;
}

export interface GrainListHooksResponse {
  hooks?: GrainHook[];
}

export interface GrainListRecordingsResponse<T> {
  cursor?: string | null;
  recordings?: T[];
}

export interface GrainClientOptions {
  accessToken?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

export class GrainClient {
  private readonly accessToken: string;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GrainClientOptions = {}) {
    this.accessToken = options.accessToken ?? "";
    this.apiBase = normalizeBaseUrl(options.apiBase ?? Deno.env.get("GRAIN_API_BASE") ?? GRAIN_API_BASE);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static authorizationUrl(): string {
    return Deno.env.get("GRAIN_OAUTH_AUTHORIZE_URL") ?? GRAIN_AUTHORIZE_URL;
  }

  static tokenUrl(): string {
    return Deno.env.get("GRAIN_OAUTH_TOKEN_URL") ?? GRAIN_TOKEN_URL;
  }

  static buildAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge?: string | null;
  }): string {
    const url = new URL(GrainClient.authorizationUrl());
    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", params.state);
    if (params.codeChallenge) {
      url.searchParams.set("code_challenge", params.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }

  static async exchangeCodeForTokens(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
    fetchImpl?: typeof fetch;
  }): Promise<GrainTokenResponse> {
    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    };
    if (params.codeVerifier) body.code_verifier = params.codeVerifier;

    const response = await (params.fetchImpl ?? fetch)(GrainClient.tokenUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    return await parseJsonResponse<GrainTokenResponse>(response, "Grain token exchange failed");
  }

  static async refreshTokens(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    fetchImpl?: typeof fetch;
  }): Promise<GrainTokenResponse> {
    const response = await (params.fetchImpl ?? fetch)(GrainClient.tokenUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: params.refreshToken,
        client_id: params.clientId,
        client_secret: params.clientSecret,
      }),
    });
    return await parseJsonResponse<GrainTokenResponse>(response, "Grain token refresh failed");
  }

  async listRecordings<T = unknown>(params: Omit<GrainListRecordingsParams, "token" | "fetchImpl" | "apiBase"> = {}) {
    return await listRecordings<T>({
      ...params,
      token: this.accessToken,
      fetchImpl: this.fetchImpl,
      apiBase: this.apiBase,
    });
  }

  async getRecording<T = unknown>(id: string, include: GrainRecordingInclude = {}) {
    return await getRecording<T>(this.accessToken, id, include, this.fetchImpl, this.apiBase);
  }

  async getRecordingTranscript(id: string) {
    return await getRecordingTranscript(this.accessToken, id, this.fetchImpl, this.apiBase);
  }

  async createHook(params: {
    hookUrl: string;
    hookType: GrainHookType;
    include?: GrainRecordingInclude;
  }) {
    return await createHook(this.accessToken, params, this.fetchImpl, this.apiBase);
  }

  async listHooks(params: { hookType?: GrainHookType; state?: "enabled" | "disabled" } = {}) {
    return await listHooks(this.accessToken, params, this.fetchImpl, this.apiBase);
  }

  async deleteHook(id: string) {
    return await deleteHook(this.accessToken, id, this.fetchImpl, this.apiBase);
  }

  async testToken() {
    return await this.listRecordings({ include: { participants: false } });
  }
}

export async function listRecordings<T = unknown>(
  params: GrainListRecordingsParams,
): Promise<GrainListRecordingsResponse<T>> {
  const token = cleanToken(params.token);
  const body: Record<string, unknown> = {
    include: params.include ?? { participants: true, ai_summary: true, ai_action_items: true, calendar_event: true },
  };
  const filter: Record<string, unknown> = {};
  if (params.cursor) body.cursor = params.cursor;
  if (params.titleSearch?.trim()) filter.title_search = params.titleSearch.trim();
  if (params.afterDateTime) filter.after_datetime = params.afterDateTime;
  if (params.beforeDateTime) filter.before_datetime = params.beforeDateTime;
  if (Object.keys(filter).length > 0) body.filter = filter;

  const response = await (params.fetchImpl ?? fetch)(`${normalizeBaseUrl(params.apiBase ?? GRAIN_API_BASE)}/_/public-api/v2/recordings`, {
    method: "POST",
    headers: grainHeaders(token),
    body: JSON.stringify(body),
  });
  return await parseJsonResponse<GrainListRecordingsResponse<T>>(response, "Grain list recordings failed");
}

export async function getRecording<T = unknown>(
  token: string,
  id: string,
  include: GrainRecordingInclude = {},
  fetchImpl: typeof fetch = fetch,
  apiBase = GRAIN_API_BASE,
): Promise<T> {
  if (!id.trim()) throw new Error("Grain recording id is required");
  const response = await fetchImpl(`${normalizeBaseUrl(apiBase)}/_/public-api/v2/recordings/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: grainHeaders(cleanToken(token)),
    body: JSON.stringify({ include }),
  });
  return await parseJsonResponse<T>(response, "Grain get recording failed");
}

export async function getRecordingTranscript(
  token: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
  apiBase = GRAIN_API_BASE,
): Promise<unknown[]> {
  if (!id.trim()) throw new Error("Grain recording id is required");
  const response = await fetchImpl(`${normalizeBaseUrl(apiBase)}/_/public-api/v2/recordings/${encodeURIComponent(id)}/transcript`, {
    headers: grainHeaders(cleanToken(token)),
  });
  return await parseJsonResponse<unknown[]>(response, "Grain get transcript failed");
}

export async function createHook(
  token: string,
  params: {
    hookUrl: string;
    hookType: GrainHookType;
    include?: GrainRecordingInclude;
  },
  fetchImpl: typeof fetch = fetch,
  apiBase = GRAIN_API_BASE,
): Promise<GrainHook> {
  const hookUrl = params.hookUrl.trim();
  if (!hookUrl) throw new Error("Grain hook URL is required");
  const response = await fetchImpl(`${normalizeBaseUrl(apiBase)}/_/public-api/v2/hooks/create`, {
    method: "POST",
    headers: grainHeaders(cleanToken(token)),
    body: JSON.stringify({
      hook_url: hookUrl,
      hook_type: params.hookType,
      include: params.include ?? {},
    }),
  });
  return await parseJsonResponse<GrainHook>(response, "Grain create hook failed");
}

export async function listHooks(
  token: string,
  params: { hookType?: GrainHookType; state?: "enabled" | "disabled" } = {},
  fetchImpl: typeof fetch = fetch,
  apiBase = GRAIN_API_BASE,
): Promise<GrainListHooksResponse> {
  const filter: Record<string, string> = {};
  if (params.hookType) filter.hook_type = params.hookType;
  if (params.state) filter.state = params.state;

  const response = await fetchImpl(`${normalizeBaseUrl(apiBase)}/_/public-api/v2/hooks`, {
    method: "POST",
    headers: grainHeaders(cleanToken(token)),
    body: JSON.stringify(Object.keys(filter).length ? { filter } : {}),
  });
  return await parseJsonResponse<GrainListHooksResponse>(response, "Grain list hooks failed");
}

export async function deleteHook(
  token: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
  apiBase = GRAIN_API_BASE,
): Promise<{ success: boolean }> {
  if (!id.trim()) throw new Error("Grain hook id is required");
  const response = await fetchImpl(`${normalizeBaseUrl(apiBase)}/_/public-api/v2/hooks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: grainHeaders(cleanToken(token)),
  });
  return await parseJsonResponse<{ success: boolean }>(response, "Grain delete hook failed");
}

export async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = extractErrorMessage(payload) ?? `${fallbackMessage} with HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

// Backward-compat re-export. Canonical implementation lives in `./oauth-pkce.ts`
// so all providers share the same RFC 7636 verifier/challenge shape.
export { createPkcePair } from "./oauth-pkce.ts";

export function parseGrainOAuthState(value: string | null | undefined): { state: string; codeVerifier: string } | null {
  if (!value?.startsWith("grain:")) return null;
  const [, state, codeVerifier] = value.split(":");
  if (!state || !codeVerifier) return null;
  return { state, codeVerifier };
}

export function serializeGrainOAuthState(state: string, codeVerifier: string): string {
  return `grain:${state}:${codeVerifier}`;
}

function grainHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Public-Api-Version": Deno.env.get("GRAIN_PUBLIC_API_VERSION") ?? GRAIN_PUBLIC_API_VERSION,
  };
}

function cleanToken(token: string): string {
  const cleaned = token.trim().replace(/^Bearer\s+/i, "");
  if (!cleaned) throw new Error("Grain access token is required");
  return cleaned;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (typeof record.message === "string") return record.message;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
  }
  return null;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}
