import type { ListPageParams, ListPageResult } from "./connector-list-page.ts";

export interface PlaudTokenResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type?: string | null;
  expires_in?: number | null;
}

export interface PlaudListFilesResponse {
  data: PlaudFile[];
  page?: number;
  page_size?: number;
  total?: number;
}

export interface PlaudTranscriptSegment {
  speaker?: string | null;
  speaker_name?: string | null;
  content?: string | null;
  text?: string | null;
  start_time?: number | null;
  end_time?: number | null;
}

export interface PlaudFile {
  id: string;
  name?: string | null;
  filename?: string | null;
  created_at?: string | number | null;
  start_at?: string | null;
  start_time?: number | null;
  end_time?: number | null;
  duration?: number | null;
  serial_number?: string | null;
  presigned_url?: string | null;
  source_list?: PlaudSourceItem[] | null;
  note_list?: PlaudNoteItem[] | null;
  trans_result?: PlaudTranscriptSegment[] | null;
  ai_content?: unknown;
  summary_list?: unknown[] | null;
  filesize?: number | null;
  file_md5?: string | null;
  filetype?: string | null;
  fullname?: string | null;
  version?: number | null;
  version_ms?: number | null;
  edit_time?: number | null;
  edit_from?: string | null;
  is_trash?: boolean | null;
  timezone?: number | null;
  zonemins?: number | null;
  scene?: number | null;
  filetag_id_list?: string[] | null;
  is_trans?: boolean | null;
  is_summary?: boolean | null;
}

export interface PlaudSourceItem {
  id?: string | null;
  data_type?: string | null;
  data_content?: string | null;
}

export interface PlaudNoteItem {
  id?: string | null;
  data_type?: string | null;
  data_content?: string | null;
}

export interface PlaudCurrentUser {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  data?: { email?: string | null } | null;
  [key: string]: unknown;
}

export interface PlaudDevice {
  sn: string;
  name: string;
  model: string;
  version_number: number;
}

export interface PlaudDeviceListResponse {
  status: number;
  msg?: string;
  data_devices: PlaudDevice[];
}

export interface PlaudRecordingsResponse {
  status: number;
  msg?: string;
  data_file_total: number;
  data_file_list: PlaudFile[];
}

export interface PlaudWorkspace {
  workspace_id: string;
  member_id: string;
  name: string;
  role: string;
  status: string;
  workspace_type: string;
  region?: string;
  api_domain?: string;
  created_at?: string;
  creator_user_id?: string;
}

export interface PlaudWorkspaceListResponse {
  status: number;
  msg?: string;
  data: {
    workspaces: PlaudWorkspace[];
  };
  type?: string;
}

export interface PlaudWorkspaceTokenResponse {
  status: number;
  msg?: string;
  data: {
    status: number;
    workspace_token: string;
    expires_in: number;
    wt_expires_at: number;
    refresh_token: string;
    refresh_expires_in: number;
    refresh_expires_at: number;
    workspace_id: string;
    member_id: string;
    role: string;
  };
}

export interface PlaudConnectionMetadata {
  auth_type?: string | null;
  api_base?: string | null;
  workspace_id?: string | null;
  server_key?: string | null;
  using_user_token_fallback?: boolean | null;
  workspace_error?: string | null;
}

const DEFAULT_DEVELOPER_API_BASE = 'https://platform.plaud.ai/developer/api';
const DEFAULT_AUTHORIZATION_URL = 'https://web.plaud.ai/platform/oauth';
const DEFAULT_TOKEN_URL = `${DEFAULT_DEVELOPER_API_BASE}/oauth/third-party/access-token`;
const DEFAULT_REFRESH_URL = `${DEFAULT_DEVELOPER_API_BASE}/oauth/third-party/access-token/refresh`;
export const DEFAULT_PLAUD_API_BASE = 'https://api.plaud.ai';
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const PLAUD_SERVER_MAP = {
  global: 'https://api.plaud.ai',
  eu: 'https://api-euc1.plaud.ai',
  apse1: 'https://api-apse1.plaud.ai',
} as const;

const BROWSER_HEADERS: Record<string, string> = {
  'Accept': '*/*',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://web.plaud.ai',
  'Referer': 'https://web.plaud.ai/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'app-platform': 'web',
  'edit-from': 'web',
  'Priority': 'u=3, i',
};

interface PlaudRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  auth?: 'user' | 'workspace';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: HeadersInit;
}

export class PlaudClient {
  static apiBase(): string {
    return normalizeBaseUrl(Deno.env.get('PLAUD_API_BASE') ?? DEFAULT_DEVELOPER_API_BASE);
  }

  static authorizationUrl(): string {
    return Deno.env.get('PLAUD_AUTH_URL') ?? DEFAULT_AUTHORIZATION_URL;
  }

  static tokenUrl(): string {
    return Deno.env.get('PLAUD_TOKEN_URL') ?? DEFAULT_TOKEN_URL;
  }

  static refreshUrl(): string {
    return Deno.env.get('PLAUD_REFRESH_URL') ?? DEFAULT_REFRESH_URL;
  }

  static buildAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
  }): string {
    const url = new URL(PlaudClient.authorizationUrl());
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', params.state);
    return url.toString();
  }

  static async exchangeCodeForTokens(params: {
    clientId: string;
    clientSecret?: string | null;
    code: string;
    redirectUri: string;
    codeVerifier: string;
    state: string;
    fetchImpl?: typeof fetch;
  }): Promise<Response> {
    const fetchImpl = params.fetchImpl ?? fetch;
    return fetchImpl(PlaudClient.tokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${btoa(`${params.clientId}:${params.clientSecret ?? ''}`)}`,
      },
      body: new URLSearchParams({
        code: params.code,
        redirect_uri: params.redirectUri,
        code_verifier: params.codeVerifier,
        state: params.state,
      }),
    });
  }

  static async refreshAccessToken(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
    return fetchImpl(PlaudClient.refreshUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ refresh_token: refreshToken }),
    });
  }

  static async apiRequest(path: string, accessToken: string, options: RequestInit = {}): Promise<Response> {
    return PlaudClient.fetchWithRetry(`${PlaudClient.apiBase()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
    });
  }

  static async fetchWithRetry(url: string, options: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<Response> {
    let lastResponse: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetchImpl(url, options);
      if (!RETRYABLE_STATUSES.has(response.status)) return response;
      lastResponse = response;
      const retryAfter = Number(response.headers.get('Retry-After'));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 250 * (attempt + 1);
      await sleep(delayMs);
    }
    return lastResponse!;
  }

  static async getCurrentUser(accessToken: string): Promise<PlaudCurrentUser> {
    const response = await PlaudClient.apiRequest('/open/third-party/users/current', accessToken);
    return parseJsonResponse<PlaudCurrentUser>(response, 'Plaud current user request failed');
  }

  static async listFiles(accessToken: string, page = 1, pageSize = 50): Promise<PlaudListFilesResponse> {
    const response = await PlaudClient.apiRequest(
      `/open/third-party/files/?page=${encodeURIComponent(String(page))}&page_size=${encodeURIComponent(String(pageSize))}`,
      accessToken,
    );
    return parseJsonResponse<PlaudListFilesResponse>(response, 'Plaud files request failed');
  }

  static async getFile(accessToken: string, fileId: string): Promise<PlaudFile> {
    const response = await PlaudClient.apiRequest(`/open/third-party/files/${encodeURIComponent(fileId)}`, accessToken);
    return parseJsonResponse<PlaudFile>(response, 'Plaud file request failed');
  }

  private readonly userToken: string;
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private workspaceToken?: string;
  private resolvedWorkspaceId?: string;
  private workspaceFetchInFlight?: Promise<void>;
  private workspaceFallbackToUserToken = false;
  private workspaceResolutionError: string | null = null;

  constructor(
    userToken: string,
    options: {
      apiBase?: string;
      workspaceId?: string | null;
      fetchImpl?: typeof fetch;
    } = {},
  ) {
    this.userToken = userToken;
    this.apiBaseUrl = normalizeBaseUrl(options.apiBase ?? DEFAULT_PLAUD_API_BASE);
    this.resolvedWorkspaceId = options.workspaceId ?? undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get apiBase(): string {
    return this.apiBaseUrl;
  }

  get workspaceId(): string | undefined {
    return this.resolvedWorkspaceId;
  }

  get usingUserTokenFallback(): boolean {
    return this.workspaceFallbackToUserToken;
  }

  get lastWorkspaceResolutionError(): string | null {
    return this.workspaceResolutionError;
  }

  async getCurrentUser(): Promise<PlaudCurrentUser> {
    const data = await this.requestJson<PlaudCurrentUser>('/user/me', {
      auth: 'user',
      requireStatusZero: false,
    });
    return data;
  }

  async listDevices(): Promise<PlaudDeviceListResponse> {
    return await this.requestJson<PlaudDeviceListResponse>('/device/list', {
      auth: 'user',
    });
  }

  async listWorkspaces(): Promise<PlaudWorkspaceListResponse> {
    const data = await this.requestJson<PlaudWorkspaceListResponse>('/team-app/workspaces/list', {
      auth: 'user',
      query: { need_personal_workspace: true },
    });
    const workspaces = data.data?.workspaces;
    if (!Array.isArray(workspaces)) {
      throw new Error('Plaud API error: no workspaces returned');
    }
    return data;
  }

  async listFilesByOffset(skip = 0, limit = 50): Promise<PlaudRecordingsResponse> {
    return await this.requestJson<PlaudRecordingsResponse>('/file/simple/web', {
      query: {
        skip,
        limit,
        is_trash: 0,
        sort_by: 'edit_time',
        is_desc: true,
      },
    });
  }

  async getFiles(fileIds: string[]): Promise<PlaudFile[]> {
    const ids = fileIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return [];
    const data = await this.requestJson<PlaudRecordingsResponse>('/file/list', {
      method: 'POST',
      body: ids,
    });
    return Array.isArray(data.data_file_list) ? data.data_file_list : [];
  }

  async getFile(fileId: string): Promise<PlaudFile> {
    const [file] = await this.getFiles([fileId]);
    if (!file) throw new Error(`Plaud API error: recording not found (${fileId})`);
    return file;
  }

  async getAudioUrl(fileId: string): Promise<string | null> {
    const data = await this.requestJson<{ temp_url?: string | null; temp_url_opus?: string | null }>(`/file/temp-url/${encodeURIComponent(fileId)}`);
    return data.temp_url_opus ?? data.temp_url ?? null;
  }

  private async ensureWorkspaceToken(): Promise<void> {
    if (this.workspaceToken || this.workspaceFallbackToUserToken) return;
    if (!this.workspaceFetchInFlight) {
      this.workspaceFetchInFlight = this.fetchWorkspaceToken();
    }
    try {
      await this.workspaceFetchInFlight;
    } finally {
      this.workspaceFetchInFlight = undefined;
    }
  }

  private async fetchWorkspaceToken(): Promise<void> {
    this.workspaceResolutionError = null;

    if (this.resolvedWorkspaceId) {
      try {
        this.workspaceToken = await this.mintWorkspaceToken(this.resolvedWorkspaceId);
        return;
      } catch {
        this.workspaceToken = undefined;
      }
    }

    try {
      const workspaceList = await this.listWorkspaces();
      this.resolvedWorkspaceId = pickPersonalWorkspaceId(workspaceList);
      this.workspaceToken = await this.mintWorkspaceToken(this.resolvedWorkspaceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[plaud] workspace token mint failed, falling back to user token:', message);
      this.workspaceResolutionError = message;
      this.workspaceFallbackToUserToken = true;
      this.workspaceToken = undefined;
    }
  }

  private async mintWorkspaceToken(workspaceId: string): Promise<string> {
    const response = await this.requestJson<PlaudWorkspaceTokenResponse>(`/user-app/auth/workspace/token/${encodeURIComponent(workspaceId)}`, {
      auth: 'user',
      method: 'POST',
      body: {},
    });

    const workspaceToken = response.data?.workspace_token;
    if (!workspaceToken) {
      throw new Error(`Plaud API error: ${response.msg || 'failed to mint workspace token'}`);
    }
    this.resolvedWorkspaceId = response.data.workspace_id || workspaceId;
    return workspaceToken;
  }

  private async requestJson<T>(
    path: string,
    options: PlaudRequestOptions & { requireStatusZero?: boolean } = {},
  ): Promise<T> {
    const response = await this.request(path, options);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Plaud API error (${response.status}): ${extractPlaudErrorDetail(text, response.statusText)}`);
    }

    const data = (text ? JSON.parse(text) : {}) as T & { status?: unknown; msg?: unknown };
    if (options.requireStatusZero !== false && typeof data.status === 'number' && data.status !== 0) {
      throw new Error(`Plaud API error: ${String(data.msg ?? 'request failed')}`);
    }
    return data as T;
  }

  private async request(path: string, options: PlaudRequestOptions = {}): Promise<Response> {
    if (options.auth !== 'user') {
      await this.ensureWorkspaceToken();
    }

    const bearerToken = options.auth === 'user'
      ? this.userToken
      : this.workspaceToken ?? this.userToken;

    const url = buildPlaudUrl(this.apiBaseUrl, path, options.query, options.method ?? 'GET');
    const body = preparePlaudBody(options.body);

    return await PlaudClient.fetchWithRetry(url.toString(), {
      method: options.method ?? 'GET',
      headers: {
        ...BROWSER_HEADERS,
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      body,
    }, this.fetchImpl);
  }
}

/** Plaud offset page size. The list endpoint has no native date filter — see plaudListPage. */
export const PLAUD_LIST_PAGE_SIZE = 50;

/**
 * Post-fetch date filter for a Plaud file. Plaud's list endpoint has NO native
 * date-range parameter (28-RESEARCH SPIKE Finding 1), so a sync-all over a date
 * window pages through ALL files and discards out-of-range ones in code. This is
 * a documented inefficiency, NOT impossible — Plaud DOES support server-side
 * sync-all (correcting the prior "technically impossible" classification).
 */
export function isPlaudFileWithinRange(
  file: PlaudFile,
  dateStartMs: number | null,
  dateEndMs: number | null,
): boolean {
  const candidates: Array<string | number | null | undefined> = [
    file.start_at,
    typeof file.created_at === "string" ? file.created_at : null,
    file.start_time,
    typeof file.created_at === "number" ? file.created_at : null,
  ];
  let startMs: number | null = null;
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) {
        startMs = parsed;
        break;
      }
    } else if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      startMs = candidate;
      break;
    }
  }
  if (startMs == null) return false;
  if (dateStartMs != null && startMs < dateStartMs) return false;
  if (dateEndMs != null && startMs > dateEndMs) return false;
  return true;
}

/**
 * Uniform Phase 28 (SYNC-02) list-page wrapper for Plaud.
 *
 * Plaud is webhook-first, but it DOES support server-side sync-all via offset
 * paging — `listFilesByOffset(skip, limit)`. The opaque cursor is the
 * serialized skip offset:
 *   - cursor: String(skip), default 0
 *   - date window: applied POST-FETCH via isPlaudFileWithinRange (no native filter)
 *   - nextCursor: page returned fewer than page_size ? null : String(skip + page_size)
 *
 * Termination is driven by the RAW page length (not the post-filter count) so a
 * window with all out-of-range files on an early page does not end the stream
 * prematurely. `accessToken` is passed to PlaudClient and NEVER logged
 * (T-28-08). Items are guarded for a non-empty `id` (T-28-09). Provider/network
 * errors resolve as an exhausted page.
 */
export async function plaudListPage(
  params: ListPageParams,
  fetchImpl: typeof fetch = fetch,
): Promise<ListPageResult<PlaudFile>> {
  const skip = params.cursor ? parseInt(params.cursor, 10) : 0;
  const safeSkip = Number.isFinite(skip) && skip >= 0 ? skip : 0;
  const limit = PLAUD_LIST_PAGE_SIZE;
  const dateStartMs = params.dateStart ? Date.parse(params.dateStart) : null;
  const dateEndMs = params.dateEnd ? Date.parse(params.dateEnd) : null;

  try {
    const client = new PlaudClient(params.accessToken, { fetchImpl });
    const res = await client.listFilesByOffset(safeSkip, limit);
    const rawFiles = Array.isArray(res.data_file_list) ? res.data_file_list : [];
    const items = rawFiles.filter(
      (file) =>
        typeof file?.id === "string" &&
        file.id.trim() !== "" &&
        isPlaudFileWithinRange(
          file,
          Number.isFinite(dateStartMs as number) ? (dateStartMs as number) : null,
          Number.isFinite(dateEndMs as number) ? (dateEndMs as number) : null,
        ),
    );
    // Terminate on a SHORT raw page (fewer than the requested page size).
    const nextCursor = rawFiles.length < limit ? null : String(safeSkip + limit);
    return { items, nextCursor };
  } catch {
    return { items: [], nextCursor: null };
  }
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function parsePlaudOAuthState(value: string | null | undefined): { state: string; codeVerifier: string } | null {
  if (!value?.startsWith('plaud:')) return null;
  const [, state, codeVerifier] = value.split(':');
  if (!state || !codeVerifier) return null;
  return { state, codeVerifier };
}

export function serializePlaudOAuthState(state: string, codeVerifier: string): string {
  return `plaud:${state}:${codeVerifier}`;
}

export async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${fallbackMessage}: HTTP ${response.status} ${extractPlaudErrorDetail(text, response.statusText)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export function isValidPlaudApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Object.values(PLAUD_SERVER_MAP).includes(normalizeBaseUrl(url.toString()) as typeof PLAUD_SERVER_MAP[keyof typeof PLAUD_SERVER_MAP]);
  } catch {
    return false;
  }
}

export function serverKeyFromApiBase(apiBase: string): string {
  const normalized = normalizeBaseUrl(apiBase);
  for (const [key, value] of Object.entries(PLAUD_SERVER_MAP)) {
    if (value === normalized) return key;
  }
  return 'custom';
}

export function decodePlaudAccessTokenExpiry(token: string): number | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function parsePlaudConnectionMetadata(value: unknown): PlaudConnectionMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return {
    auth_type: typeof input.auth_type === 'string' ? input.auth_type : null,
    api_base: typeof input.api_base === 'string' ? normalizeBaseUrl(input.api_base) : null,
    workspace_id: typeof input.workspace_id === 'string' ? input.workspace_id : null,
    server_key: typeof input.server_key === 'string' ? input.server_key : null,
    using_user_token_fallback: typeof input.using_user_token_fallback === 'boolean' ? input.using_user_token_fallback : null,
    workspace_error: typeof input.workspace_error === 'string' ? input.workspace_error : null,
  };
}

export async function fetchPlaudUserMeEmail(
  accessToken: string,
  apiBase: string = DEFAULT_PLAUD_API_BASE,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const client = new PlaudClient(accessToken, { apiBase, fetchImpl });
    const user = await client.getCurrentUser();
    const rawEmail = user.email ?? user.data?.email ?? null;
    return typeof rawEmail === 'string' && rawEmail.includes('@')
      ? rawEmail.trim().toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export function pickPersonalWorkspaceId(response: PlaudWorkspaceListResponse): string {
  const workspaces = response.data?.workspaces ?? [];
  if (workspaces.length === 0) {
    throw new Error('Plaud API error: no workspaces returned');
  }
  const personal = workspaces.find((workspace) => workspace.workspace_type === '0');
  return (personal ?? workspaces[0]).workspace_id;
}

function buildPlaudUrl(
  apiBase: string,
  path: string,
  query: Record<string, string | number | boolean | null | undefined> | undefined,
  method: string,
): URL {
  if (!isValidPlaudApiUrl(apiBase)) {
    throw new Error('Plaud API error: invalid API base');
  }
  const url = new URL(path, `${normalizeBaseUrl(apiBase)}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  if (method === 'GET' && !url.searchParams.has('r')) {
    url.searchParams.set('r', Math.random().toString());
  }
  return url;
}

function preparePlaudBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (Array.isArray(body)) return JSON.stringify(body);
  if (typeof body === 'object') {
    return JSON.stringify({ ...(body as Record<string, unknown>), r: Math.random() });
  }
  return JSON.stringify(body);
}

function extractPlaudErrorDetail(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; error?: unknown; message?: unknown; msg?: unknown };
    return String(parsed.detail ?? parsed.error ?? parsed.message ?? parsed.msg ?? (text || fallback));
  } catch {
    return text || fallback;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return atob(base64);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
