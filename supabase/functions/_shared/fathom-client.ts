import type { ListPageParams, ListPageResult } from "./connector-list-page.ts";

export const FATHOM_API_BASE = "https://api.fathom.ai";

export interface FathomFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
  /** Let a resumable caller checkpoint and honor Retry-After instead. */
  retryRateLimits?: boolean;
}

export class FathomRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(response: Response) {
    super("FATHOM_RATE_LIMITED");
    this.name = "FathomRateLimitError";
    const retryAfter = response.headers.get("Retry-After");
    const raw = retryAfter ?? response.headers.get("RateLimit-Reset");
    const seconds = raw && /^\d+(?:\.\d+)?$/.test(raw)
      ? Number(raw)
      : retryAfter ? (Date.parse(retryAfter) - Date.now()) / 1000 : Number.NaN;
    // A delayed self-chain still runs inside the current Edge invocation.
    // Re-check long provider cooldowns in bounded hops rather than sleeping
    // beyond its runtime ceiling; another 429 preserves the same cursor again.
    this.retryAfterSeconds = Number.isFinite(seconds)
      ? Math.min(60, Math.max(1, Math.ceil(seconds)))
      : 60;
  }
}

/** A single Fathom meeting list item. `recording_id` is Fathom's numeric id (kept as-is, never coerced). */
export interface FathomMeetingItem {
  recording_id: number | string;
  [key: string]: unknown;
}

interface FathomMeetingsListResponse {
  items?: FathomMeetingItem[];
  next_cursor?: string | null;
}

export class FathomClient {
  private static async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static shouldRetryStatus(status: number): boolean {
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  static async fetchWithRetry(url: string, options: FathomFetchOptions = {}): Promise<Response> {
    const {
      maxRetries = 5,
      baseDelay = 1000,
      retryRateLimits = true,
      ...fetchOptions
    } = options;

    let lastError: unknown;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, fetchOptions);

        if (response.status === 429 && !retryRateLimits) return response;

        if (!this.shouldRetryStatus(response.status)) {
          return response;
        }

        // Handle Fathom rate limits and transient upstream outages.
        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        
        console.warn(`[FathomClient] Fathom returned ${response.status} on ${url}. Retrying in ${delayTime.toFixed(0)}ms (Attempt ${attempt + 1}/${maxRetries})`);
        
        await this.delay(delayTime);
      } catch (error) {
        console.warn(`[FathomClient] Network error on ${url}: ${error}. Retrying... (Attempt ${attempt + 1}/${maxRetries})`);
        lastError = error;
        
        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        await this.delay(delayTime);
      }
    }

    if (response) {
      return response; // Return the last retryable response if we exhausted retries
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }
}

/**
 * Uniform Phase 28 (SYNC-02) list-page wrapper for Fathom.
 *
 * Wraps `GET /external/v1/meetings` paging — it does NOT re-implement the API
 * call shape, only adapts it to the opaque-cursor contract the pager round-trips:
 *   - cursor: Fathom's `next_cursor` token, passed through verbatim
 *   - date window: dateStart/dateEnd → created_after/created_before
 *   - nextCursor: `data.next_cursor ?? null` (null = stream exhausted)
 *
 * `accessToken` is sent as a Bearer header and is NEVER logged (T-28-08).
 * Provider failures must never look like an exhausted stream. A 429 carries
 * Retry-After so the pager can keep its cursor and defer the next slice.
 */
export async function fathomListPage(
  params: ListPageParams,
  fetchImpl: typeof fetch = fetch,
): Promise<ListPageResult<FathomMeetingItem>> {
  const base = Deno.env.get("FATHOM_API_BASE") ?? FATHOM_API_BASE;
  const url = new URL(`${base.replace(/\/+$/, "")}/external/v1/meetings`);
  if (params.dateStart) url.searchParams.append("created_after", params.dateStart);
  if (params.dateEnd) url.searchParams.append("created_before", params.dateEnd);
  if (params.cursor) url.searchParams.append("cursor", params.cursor);

  const response = await fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 429) throw new FathomRateLimitError(response);
  if (!response.ok) throw new Error(`FATHOM_LIST_HTTP_${response.status}`);

  const data = (await response.json()) as FathomMeetingsListResponse;
  if (!Array.isArray(data.items)) throw new Error("FATHOM_LIST_INVALID_RESPONSE");
  const items = data.items.filter(
      (item) => item.recording_id !== null && item.recording_id !== undefined && String(item.recording_id) !== "",
    );
  return { items, nextCursor: data.next_cursor ?? null };
}
