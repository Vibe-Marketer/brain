/**
 * Array chunking helper.
 *
 * Primary use case: batching Supabase/PostgREST `.in()` filters. PostgREST
 * encodes `.in()` lists in the request URL, and large ID lists (e.g. 200+
 * recording UUIDs at 36 chars each) exceed the ~8KB URL limit, producing
 * HTTP 400 responses (QA ticket b96e351b). Chunk the ID list and merge the
 * results instead of passing an unbounded list to a single `.in()` call.
 *
 * A private copy of this logic also exists as `chunkList` in
 * `src/services/api-tokens.service.ts` — this is the shared, importable home.
 */

/**
 * Split `items` into consecutive chunks of at most `size` elements.
 * Preserves element order. Returns `[]` for an empty input.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`chunkArray: size must be a positive integer, got ${size}`);
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Default chunk size for `.in()` ID lookups against PostgREST.
 * 100 UUIDs ≈ 3.7KB of URL — comfortably under the ~8KB limit while
 * keeping request counts low.
 */
export const IN_FILTER_CHUNK_SIZE = 100;
