/**
 * responses.ts — Local REST API response helpers for callvault-api.
 *
 * All REST endpoints MUST use these helpers — never return MCP protocol envelopes
 * or raw markdown text. The public envelope contract is:
 *
 *   Success (list):  { data: T[], pagination: PaginationMeta }
 *   Success (item):  { data: T }
 *   Error:           { error: { code: string; message: string } }
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export interface PaginationMeta {
  /** Number of items in this page */
  count: number;
  /** Whether there are more pages after this one */
  has_more: boolean;
  /** Opaque cursor to pass as `cursor` query param for the next page (null if no more pages) */
  next_cursor: string | null;
  /** Page limit used for this response */
  limit: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ItemResponse<T> {
  data: T;
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Return a list success response with envelope `{ data, pagination }`.
 */
export function jsonOk<T>(data: T[], pagination: PaginationMeta): Response {
  const body: ListResponse<T> = { data, pagination };
  return json(body, 200);
}

/**
 * Return a single-item success response with envelope `{ data }`.
 */
export function jsonItem<T>(data: T): Response {
  const body: ItemResponse<T> = { data };
  return json(body, 200);
}

/**
 * Return an error response with stable `{ error: { code, message } }` envelope.
 *
 * Never includes MCP content arrays, protocol wrapper fields, or markdown text.
 */
export function jsonError(status: number, code: string, message: string): Response {
  const body: ErrorBody = { error: { code, message } };
  return json(body, status);
}
