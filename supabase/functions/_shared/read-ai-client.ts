import type { ListPageParams, ListPageResult } from "./connector-list-page.ts";

export const READ_AI_API_BASE = "https://api.read.ai";
export const READ_AI_TOKEN_URL = "https://authn.read.ai/oauth2/token";
export const READ_AI_AUTHORIZE_URL = "https://authn.read.ai/oauth2/auth";

export interface ReadAiTokenResponse {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  id_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
}

export interface ReadAiListMeetingsParams {
  token: string;
  limit?: number;
  cursor?: string | null;
  startTimeMsGte?: number | null;
  startTimeMsLte?: number | null;
  expand?: string[];
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

export interface ReadAiListResponse<T> {
  object?: string;
  url?: string;
  has_more?: boolean;
  data?: T[];
}

export interface ReadAiClientOptions {
  accessToken?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

export class ReadAiClient {
  private readonly accessToken: string;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ReadAiClientOptions = {}) {
    this.accessToken = options.accessToken ?? "";
    this.apiBase = normalizeBaseUrl(options.apiBase ?? Deno.env.get("READAI_API_BASE") ?? READ_AI_API_BASE);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static authorizationUrl(): string {
    return Deno.env.get("READAI_OAUTH_AUTHORIZE_URL") ?? READ_AI_AUTHORIZE_URL;
  }

  static tokenUrl(): string {
    return Deno.env.get("READAI_OAUTH_TOKEN_URL") ?? READ_AI_TOKEN_URL;
  }

  static buildAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scope?: string;
  }): string {
    const url = new URL(ReadAiClient.authorizationUrl());
    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("scope", params.scope ?? "openid email offline_access profile meeting:read");
    return url.toString();
  }

  static async exchangeCodeForTokens(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
    fetchImpl?: typeof fetch;
  }): Promise<ReadAiTokenResponse> {
    const fetchImpl = params.fetchImpl ?? fetch;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
    });
    if (params.codeVerifier) body.set("code_verifier", params.codeVerifier);

    const response = await fetchImpl(ReadAiClient.tokenUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${params.clientId}:${params.clientSecret}`)}`,
      },
      body,
    });

    return await parseJsonResponse<ReadAiTokenResponse>(response, "Read.ai token exchange failed");
  }

  static async refreshTokens(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    fetchImpl?: typeof fetch;
  }): Promise<ReadAiTokenResponse> {
    const fetchImpl = params.fetchImpl ?? fetch;
    const response = await fetchImpl(ReadAiClient.tokenUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${params.clientId}:${params.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: params.refreshToken,
      }),
    });

    return await parseJsonResponse<ReadAiTokenResponse>(response, "Read.ai token refresh failed");
  }

  async listMeetings(params: Omit<ReadAiListMeetingsParams, "token" | "fetchImpl" | "apiBase"> = {}) {
    return await listMeetings({
      ...params,
      token: this.accessToken,
      fetchImpl: this.fetchImpl,
      apiBase: this.apiBase,
    });
  }

  async getMeeting<T = unknown>(id: string, expand: string[] = []) {
    return await getMeeting<T>(this.accessToken, id, expand, this.fetchImpl, this.apiBase);
  }

  async testToken() {
    const response = await this.fetchImpl(`${this.apiBase}/oauth/test-token-with-scopes`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    return await parseJsonResponse<unknown>(response, "Read.ai token test failed");
  }
}

export async function listMeetings<T = unknown>(params: ReadAiListMeetingsParams): Promise<ReadAiListResponse<T>> {
  const token = params.token.trim().replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Read.ai access token is required");

  const url = new URL(`${normalizeBaseUrl(params.apiBase ?? READ_AI_API_BASE)}/v1/meetings`);
  url.searchParams.set("limit", String(clampReadAiLimit(params.limit)));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.startTimeMsGte != null) url.searchParams.set("start_time_ms.gte", String(params.startTimeMsGte));
  if (params.startTimeMsLte != null) url.searchParams.set("start_time_ms.lte", String(params.startTimeMsLte));
  for (const item of params.expand ?? []) {
    url.searchParams.append("expand[]", item);
  }

  const response = await (params.fetchImpl ?? fetch)(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return await parseJsonResponse<ReadAiListResponse<T>>(response, "Read.ai list meetings failed");
}

export async function getMeeting<T = unknown>(
  token: string,
  id: string,
  expand: string[] = [],
  fetchImpl: typeof fetch = fetch,
  apiBase = READ_AI_API_BASE,
): Promise<T> {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
  if (!cleanToken) throw new Error("Read.ai access token is required");
  if (!id.trim()) throw new Error("Read.ai meeting id is required");

  const url = new URL(`${normalizeBaseUrl(apiBase)}/v1/meetings/${encodeURIComponent(id)}`);
  for (const item of expand) {
    url.searchParams.append("expand[]", item);
  }

  const response = await fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cleanToken}`,
    },
  });
  return await parseJsonResponse<T>(response, "Read.ai retrieve meeting failed");
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

export function clampReadAiLimit(limit: number | null | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return 10;
  return Math.min(Math.max(Math.floor(limit), 1), 10);
}

/** A Read.ai meeting list item. `id` is the provider id (string, never coerced). */
export interface ReadAiMeetingItem {
  id: string;
  [key: string]: unknown;
}

/**
 * Uniform Phase 28 (SYNC-02) list-page wrapper for Read.ai.
 *
 * Wraps the existing `listMeetings` (does NOT re-implement the GET). Read.ai's
 * page size is HARD-capped to 10 by the API (clampReadAiLimit) — this requests
 * AT MOST 10/page (never more), which means many small slices for a big
 * backfill. The opaque cursor is the LAST item's id:
 *   - cursor: last-item id from the previous page (Read.ai `?cursor=`)
 *   - date window: dateStart/dateEnd → start_time_ms.gte / .lte (epoch ms)
 *   - nextCursor: (res.has_more && data.length) ? data[last].id : null
 *
 * `accessToken` is passed through and NEVER logged (T-28-08). Items are guarded
 * for a non-empty `id` (T-28-09). Provider/network errors resolve as exhausted.
 */
export async function readAiListPage(
  params: ListPageParams,
  fetchImpl: typeof fetch = fetch,
): Promise<ListPageResult<ReadAiMeetingItem>> {
  try {
    const res = await listMeetings<ReadAiMeetingItem>({
      token: params.accessToken,
      limit: clampReadAiLimit(10),
      cursor: params.cursor,
      startTimeMsGte: params.dateStart ? Date.parse(params.dateStart) : null,
      startTimeMsLte: params.dateEnd ? Date.parse(params.dateEnd) : null,
      fetchImpl,
    });
    const data = (res.data ?? []).filter(
      (item) => typeof item?.id === "string" && item.id.trim() !== "",
    );
    const nextCursor =
      res.has_more && data.length ? data[data.length - 1].id : null;
    return { items: data, nextCursor };
  } catch {
    return { items: [], nextCursor: null };
  }
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
