import type { ListPageParams, ListPageResult } from "./connector-list-page.ts";

export interface ZoomFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
}

/** A Zoom recording (one meeting). `uuid`/`id` are provider ids (never coerced). */
export interface ZoomRecordingItem {
  uuid?: string | null;
  id?: number | string | null;
  [key: string]: unknown;
}

interface ZoomRecordingsListResponse {
  meetings?: ZoomRecordingItem[];
  next_page_token?: string | null;
}

/**
 * Composite cursor Zoom hides behind the opaque `nextCursor` string. Zoom caps
 * a single `from`→`to` request at 30 days (28-RESEARCH Pitfall 3), so the
 * cursor MUST carry both the current 30-day window AND the in-window
 * next_page_token. A null page-token with a remaining window means "advance to
 * the next window"; nextCursor is null ONLY after the final window's final page.
 */
export interface ZoomComposedCursor {
  /** Inclusive window start, YYYY-MM-DD. */
  window_from: string;
  /** Inclusive window end (<= 30 days after window_from), YYYY-MM-DD. */
  window_to: string;
  /** Zoom's in-window page token; null/empty when the current window's pages are exhausted. */
  next_page_token: string | null;
  /** Hard upper bound of the whole backfill, YYYY-MM-DD — windows never advance past this. */
  range_to: string;
}

const ZOOM_WINDOW_DAYS = 30;
const ZOOM_PAGE_SIZE = 300; // Zoom max

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

/** Build the FIRST window cursor from the job's date range (or sane defaults). */
function initialZoomCursor(dateStart: string | null, dateEnd: string | null): ZoomComposedCursor {
  const rangeTo = dateEnd ? ymd(new Date(dateEnd)) : ymd(new Date());
  // Default lower bound: 30 days before range_to when no explicit start is given.
  const rangeFrom = dateStart ? ymd(new Date(dateStart)) : addDays(rangeTo, -ZOOM_WINDOW_DAYS);
  const windowEnd = addDays(rangeFrom, ZOOM_WINDOW_DAYS - 1);
  const windowTo = windowEnd > rangeTo ? rangeTo : windowEnd;
  return { window_from: rangeFrom, window_to: windowTo, next_page_token: null, range_to: rangeTo };
}

/**
 * Compute the cursor for the NEXT slice. If the current window still has a
 * page-token, stay in the window. Otherwise advance to the next 30-day window,
 * unless the current window already reached range_to → exhausted (null).
 */
function advanceZoomCursor(cur: ZoomComposedCursor, pageToken: string | null): string | null {
  if (pageToken) {
    return JSON.stringify({ ...cur, next_page_token: pageToken });
  }
  // Window exhausted — advance the date window if any range remains.
  if (cur.window_to >= cur.range_to) return null; // final window's final page
  const nextFrom = addDays(cur.window_to, 1);
  const nextEndCandidate = addDays(nextFrom, ZOOM_WINDOW_DAYS - 1);
  const nextTo = nextEndCandidate > cur.range_to ? cur.range_to : nextEndCandidate;
  return JSON.stringify({
    window_from: nextFrom,
    window_to: nextTo,
    next_page_token: null,
    range_to: cur.range_to,
  });
}

/**
 * Uniform Phase 28 (SYNC-02) list-page wrapper for Zoom — the high-risk one.
 *
 * Wraps `GET /users/me/recordings` and round-trips a COMPOSITE cursor so a
 * >30-day backfill traverses every 30-day window instead of silently
 * truncating to the most recent 30 days (28-RESEARCH Pitfall 3 / T-28-10):
 *   - cursor: JSON {window_from, window_to, next_page_token, range_to}
 *   - within a window: page via next_page_token (page_size 300)
 *   - when a window's pages exhaust: advance to the next 30-day window
 *   - nextCursor=null ONLY after the final window's final page
 *
 * `accessToken` is sent as a Bearer header and NEVER logged (T-28-08). Items
 * are guarded for a non-empty provider id — uuid or id (T-28-09). Provider/
 * network errors resolve as an exhausted page.
 */
export async function zoomListPage(
  params: ListPageParams,
  fetchImpl: typeof fetch = fetch,
): Promise<ListPageResult<ZoomRecordingItem>> {
  const cur: ZoomComposedCursor = params.cursor
    ? (JSON.parse(params.cursor) as ZoomComposedCursor)
    : initialZoomCursor(params.dateStart, params.dateEnd);

  try {
    const query = new URLSearchParams({
      from: cur.window_from,
      to: cur.window_to,
      page_size: String(ZOOM_PAGE_SIZE),
    });
    if (cur.next_page_token) query.set("next_page_token", cur.next_page_token);

    const response = await fetchImpl(
      `${ZoomClient.BASE_URL}/users/me/recordings?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) return { items: [], nextCursor: null };

    const data = (await response.json()) as ZoomRecordingsListResponse;
    const items = (data.meetings ?? []).filter((m) => {
      const id = m.uuid ?? (m.id != null ? String(m.id) : null);
      return typeof id === "string" && id.trim() !== "";
    });
    return { items, nextCursor: advanceZoomCursor(cur, data.next_page_token ?? null) };
  } catch {
    return { items: [], nextCursor: null };
  }
}

export interface ZoomApiErrorResponse {
  code?: number;
  message?: string;
}

export class ZoomClient {
  static readonly BASE_URL = 'https://api.zoom.us/v2';
  static readonly OAUTH_URL = 'https://zoom.us/oauth';

  private static async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async fetchWithRetry(url: string, options: ZoomFetchOptions = {}): Promise<Response> {
    const {
      maxRetries = 5,
      baseDelay = 1000,
      ...fetchOptions
    } = options;

    let lastError: unknown;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, fetchOptions);

        if (response.status !== 429) {
          return response;
        }

        // Handle 429 rate limit
        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;

        console.warn(`[ZoomClient] Rate limited (429) on ${url}. Retrying in ${delayTime.toFixed(0)}ms (Attempt ${attempt + 1}/${maxRetries})`);

        await this.delay(delayTime);
      } catch (error) {
        console.warn(`[ZoomClient] Network error on ${url}: ${error}. Retrying... (Attempt ${attempt + 1}/${maxRetries})`);
        lastError = error;

        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        await this.delay(delayTime);
      }
    }

    if (response) {
      return response; // Return the last 429 response if we exhausted retries
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }

  /**
   * Makes an authenticated API request to Zoom with retry logic.
   * Automatically prepends the base URL if the path doesn't start with http.
   */
  static async apiRequest(
    path: string,
    accessToken: string,
    options: ZoomFetchOptions = {}
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.BASE_URL}${path}`;

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    return this.fetchWithRetry(url, {
      ...options,
      headers,
    });
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   */
  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<Response> {
    const tokenUrl = `${this.OAUTH_URL}/token`;
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    return this.fetchWithRetry(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  }

  /**
   * Refreshes an access token using a refresh token.
   */
  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<Response> {
    const tokenUrl = `${this.OAUTH_URL}/token`;
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    return this.fetchWithRetry(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  }

  /**
   * Generates the OAuth authorization URL for user consent.
   */
  /** Required OAuth scopes for Zoom integration */
  static readonly OAUTH_SCOPES = [
    'cloud_recording:read:list_user_recordings',
    'cloud_recording:read:list_recording_files',
    'cloud_recording:read:content',
    'user:read:user',
  ].join(' ');

  static generateAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string
  ): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: this.OAUTH_SCOPES,
    });

    return `${this.OAUTH_URL}/authorize?${params.toString()}`;
  }
}
