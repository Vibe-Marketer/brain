import type { ListPageParams, ListPageResult } from "./connector-list-page.ts";

export const FATHOM_API_BASE = "https://api.fathom.ai";

export interface FathomFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
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
      ...fetchOptions
    } = options;

    let lastError: unknown;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, fetchOptions);

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
 * On a provider/network error the page resolves as exhausted ({items:[],
 * nextCursor:null}); the pager treats a terminal cursor as end-of-stream and
 * the heartbeat/reaper net (Phase 27) covers a genuinely stuck slice.
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

  try {
    const response = await fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) return { items: [], nextCursor: null };

    const data = (await response.json()) as FathomMeetingsListResponse;
    const items = (data.items ?? []).filter(
      (item) => item.recording_id !== null && item.recording_id !== undefined && String(item.recording_id) !== "",
    );
    return { items, nextCursor: data.next_cursor ?? null };
  } catch {
    // Provider/network failure on this slice → treat as exhausted; do not log the token.
    return { items: [], nextCursor: null };
  }
}
