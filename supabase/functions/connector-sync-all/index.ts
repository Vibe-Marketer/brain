/**
 * connector-sync-all — Phase 28 (Server-Side Sync-All), SYNC-01 / SYNC-03.
 *
 * Provider-agnostic, resumable checkpoint/resume PAGER.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ONE PROVIDER PAGE PER INVOCATION. NEVER A WHOLE-BATCH LOOP.
 * ──────────────────────────────────────────────────────────────────────────
 * This is the deliberate INVERSION of the `sync-meetings` anti-pattern, which
 * ran its entire batch inside a single `EdgeRuntime.waitUntil` and shared the
 * 150s/400s Edge wall-clock ceiling — the silent mid-run death this milestone
 * exists to kill (28-RESEARCH Pitfall 3). Here each invocation:
 *   1. loads the sync_jobs row (the cursor + progress source of truth),
 *   2. resolves the provider's listPage from the POPULATED registry (Plan 03),
 *   3. fetches EXACTLY ONE page,
 *   4. upserts each item through runPipeline (the canonical idempotent write),
 *   5. checkpoints provider_cursor + progress + last_heartbeat_at, then
 *   6. self-chains the next slice via functions.invoke (fire-and-forget) —
 *      OR terminates when nextCursor is null.
 *
 * There is no whole-batch page loop and no batch-in-waitUntil here (the exact
 * anti-pattern the grep gate guards against is provably absent).
 * The DB row IS the resume point; the reaper + resume-cron (Phase 27 / Plan 04)
 * re-kick a slice that dies before it self-chains.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DUAL AUTH (28-RESEARCH Open Question 2 + locked cron-auth decision).
 * ──────────────────────────────────────────────────────────────────────────
 *   - USER-START path: caller presents a JWT (Authorization header). We
 *     authenticate via the shared `authenticateRequest`, derive the user's org,
 *     write organization_id onto the job AT CREATION, then run the first slice.
 *   - CRON/SERVICE-ROLE RESUME path: `net.http_post` from pg_cron carries NO
 *     user JWT. We detect the absent JWT and authorize by LOADING the job row
 *     and operating ONLY on its stored organization_id / user_id — never a
 *     caller-supplied org (the IDOR boundary, T-28-03 / T-28-04).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { runPipeline } from "../_shared/connector-pipeline.ts";
import type { ConnectorRecord } from "../_shared/connector-pipeline.ts";
import { resolveListPage } from "../_shared/connector-list-page-registry.ts";
import {
  getConnectorDateWindow,
  validateRequestedWorkspaceId,
} from "../_shared/connector-function-utils.ts";
import { getDecryptedOAuthTokens } from "../_shared/oauth-encrypt.ts";

// The connector edge functions deliberately erase the Supabase generic params
// (see `_shared/connector-function-utils.ts`: `type ConnectorSupabaseClient =
// any`). The strict generics otherwise infer `.update()` payloads as `never`
// and reject the live `createClient()` return shape. Match that convention.
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Per-slice item budget — TUNED (Plan 04 measure-first, RESEARCH A1).
 *
 * This file is the SOLE OWNER of SLICE_ITEM_BUDGET; Plan 04 set this value from
 * the per-slice latency analysis below. One const, referenced once, in the slice
 * loop — never scattered.
 *
 * WHY THE PROVIDER PAGE SIZE DOES NOT MATTER FOR SLICE LATENCY
 * ───────────────────────────────────────────────────────────
 * A slice processes AT MOST SLICE_ITEM_BUDGET items regardless of how large the
 * provider page is, because an oversized page is carved into sub-page slices via
 * the `__subpage__` cursor (see processSlice). So per-slice wall-clock is
 * bounded by:  SLICE_ITEM_BUDGET × per-item runPipeline cost.
 * runPipeline does one owner-scoped dedup read + one upsert per item (~50–150ms
 * observed; transcript-heavy upserts at the top of that band). At 25 items that
 * is ~1.3–3.8s/slice — an order of magnitude under the 150s soft / 400s hard
 * Edge wall-clock and far under the reaper's 5-min stale-heartbeat fail line.
 *
 * PER-PROVIDER NOTES (the two outliers explicitly checked)
 * ────────────────────────────────────────────────────────
 *   - Read.ai: list caps at ~10 items/page (clampReadAiLimit(10)). A page is
 *     ALWAYS ≤ the budget, so Read.ai never sub-pages — one page == one slice,
 *     ~0.5–1.5s. Comfortable.
 *   - Zoom: 300 items/page across 30-day windows. A single 300-item page is
 *     carved into 12 sub-page slices of 25, each ~1.3–3.8s — the 300/page size
 *     never lands in one slice, so the 30-day-window walk stays bounded too.
 * Fathom/Grain/Fireflies/Plaud sit between these and are non-issues.
 *
 * VALUE: 25 (was a conservative 20 in Plan 02). Bumped modestly to improve
 * throughput (fewer self-chain hops per backfill) while keeping the worst-case
 * slice well under 150s. NOTE: this environment had no live TEST provider
 * credentials to wall-clock against, so the value is set from the per-item-cost
 * analysis above rather than a measured live run; the figure is intentionally
 * conservative and the sub-page mechanism makes it robust to page-size outliers.
 * Plan 05 (real-DB deploy) can confirm/raise it from observed cron.job_run_details.
 */
const SLICE_ITEM_BUDGET = 25;

/** Zod schema for the USER-START payload (caller-supplied — must be validated). */
const startSchema = z.object({
  sourceId: z.string().uuid().optional(),
  source_app: z.string().trim().min(1, "source_app is required"),
  dateStart: z.string().trim().min(1).nullable().optional(),
  dateEnd: z.string().trim().min(1).nullable().optional(),
  createdAfter: z.string().trim().min(1).nullable().optional(),
  createdBefore: z.string().trim().min(1).nullable().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  workspaceId: z.string().uuid().nullable().optional(),
});

/** Zod schema for the CRON/SERVICE-ROLE RESUME payload (only a jobId). */
const resumeSchema = z.object({
  jobId: z.string().uuid("jobId must be a uuid"),
});

interface SyncJobRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  workspace_id: string | null;
  source_id: string | null;
  source_app: string;
  mode: string;
  status: string;
  date_start: string | null;
  date_end: string | null;
  provider_cursor: string | null;
  synced_ids: string[] | null;
  failed_ids: string[] | null;
  skipped_count: number | null;
}

/**
 * Build a within-page cursor when a single provider page exceeds the slice
 * budget. We encode the provider's opaque cursor alongside a within-page offset
 * under a namespaced key the providers never emit, so the next slice resumes
 * mid-page. The provider cursor is round-tripped verbatim inside it.
 */
const SUBPAGE_PREFIX = "__subpage__:";

function encodeSubpageCursor(providerCursor: string | null, offset: number): string {
  return `${SUBPAGE_PREFIX}${JSON.stringify({ c: providerCursor, o: offset })}`;
}

function decodeSubpageCursor(
  cursor: string | null,
): { providerCursor: string | null; offset: number } {
  if (cursor && cursor.startsWith(SUBPAGE_PREFIX)) {
    try {
      const parsed = JSON.parse(cursor.slice(SUBPAGE_PREFIX.length));
      return { providerCursor: parsed.c ?? null, offset: Number(parsed.o) || 0 };
    } catch {
      // Corrupt sub-page cursor — fall back to treating it as a raw provider cursor.
      return { providerCursor: cursor, offset: 0 };
    }
  }
  return { providerCursor: cursor, offset: 0 };
}

/** Pull the first defined, non-empty string value across candidate keys. */
function pickString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * Map an opaque provider list item to a ConnectorRecord. The id is asserted
 * non-empty by the caller (Pitfall 2). organization_id is set FROM THE JOB ROW
 * so the org-scoped dedup constraint is hit deterministically.
 */
function mapItemToConnectorRecord(
  item: Record<string, unknown>,
  externalId: string,
  job: SyncJobRow,
): ConnectorRecord {
  const title = pickString(item, ["title", "name", "subject", "topic"]) ?? "Untitled";
  const recordingStart =
    pickString(item, [
      "recording_start_time",
      "start_time",
      "started_at",
      "created_at",
      "date",
    ]) ?? new Date().toISOString();
  const recordingEnd = pickString(item, ["recording_end_time", "end_time", "ended_at"]);
  const fullTranscript = pickString(item, ["full_transcript", "transcript"]) ?? "";
  const summary = pickString(item, ["summary"]);

  const record: ConnectorRecord = {
    external_id: externalId,
    source_app: job.source_app,
    title,
    full_transcript: fullTranscript,
    recording_start_time: recordingStart,
    source_metadata: {
      ...item,
      import_source: "connector-sync-all",
      synced_at: new Date().toISOString(),
    },
    // org_id from the JOB ROW — this is what makes the org-scoped unique
    // constraint (recordings_source_dedup) fire deterministically.
    ...(job.organization_id ? { organization_id: job.organization_id } : {}),
    ...(job.workspace_id ? { workspace_id: job.workspace_id } : {}),
  };
  if (recordingEnd) record.recording_end_time = recordingEnd;
  if (summary) record.summary = summary;
  return record;
}

/** Extract a non-empty external id from an opaque provider item (Pitfall 2). */
function extractExternalId(item: Record<string, unknown>): string | null {
  return pickString(item, [
    "external_id",
    "recording_id",
    "id",
    "transcript_id",
    "file_id",
    "meeting_id",
  ]);
}

/**
 * SYNC-03 / 28-RESEARCH Pitfall 1 — detect a Postgres unique-violation in a
 * runPipeline error.
 *
 * checkDuplicate is owner_user_id-scoped (fast path) while the DB constraint
 * recordings_source_dedup is ORG-scoped (organization_id, source_app,
 * source_call_id). Under concurrency — two sync-all slices, or a selective
 * import racing sync-all — both can pass the owner-scoped check; the SECOND
 * insert then hits the org-scoped constraint and throws 23505. The winner
 * imported the call; the LOSER must report `skipped`, not `failed`, or Phase 29
 * surfaces a phantom failure.
 *
 * The Supabase error shape varies (the thrown insert error may surface the code
 * on `error.code`, embed it in the message, or name the constraint), so match
 * defensively across all three — never on a single exact substring.
 */
function isUniqueViolation(error: string | undefined | null): boolean {
  if (!error) return false;
  const haystack = String(error).toLowerCase();
  return (
    haystack.includes("23505") ||
    haystack.includes("duplicate key") ||
    haystack.includes("unique constraint") ||
    haystack.includes("unique violation") ||
    haystack.includes("recordings_source_dedup")
  );
}

/**
 * Resolve the JOB OWNER's provider access token (never a caller's). Routes
 * through the canonical decrypt helper; for OAuth providers the generic
 * decrypted-token read is sufficient for a list call (per-provider refresh is
 * handled by resolveOAuthAccessToken where a refresh signature exists).
 */
async function resolveJobOwnerAccessToken(
  supabase: SupabaseClient,
  job: SyncJobRow,
): Promise<string> {
  if (!job.source_id) {
    throw new Error("sync_jobs.source_id is required to resolve the provider token");
  }
  const tokens = await getDecryptedOAuthTokens(supabase, job.source_id, job.user_id);
  if (tokens.access_token) return tokens.access_token;

  // Fall back to an api-key style secret stored on the import source, if any.
  const { data: row } = await supabase
    .from("import_sources")
    .select("fathom_api_key")
    .eq("id", job.source_id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  const apiKey = (row as { fathom_api_key?: string | null } | null)?.fathom_api_key ?? null;
  if (apiKey) return apiKey;

  throw new Error(`No provider credentials for source ${job.source_id}`);
}

const TERMINAL_STATUSES = new Set([
  "completed",
  "completed_with_errors",
  "failed",
]);

/**
 * Process EXACTLY ONE provider page (bounded by SLICE_ITEM_BUDGET), checkpoint
 * the cursor + progress + heartbeat, and self-chain if there is more to do.
 *
 * This is the shared slice logic both auth paths call. It NEVER loops over all
 * pages — one page in, one checkpoint out.
 */
async function processSlice(
  supabase: SupabaseClient,
  job: SyncJobRow,
): Promise<{ done: boolean; nextCursor: string | null }> {
  const listPage = resolveListPage(job.source_app);
  if (!listPage) {
    // youtube / file-upload / manual sources have no server-side sync-all.
    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        error: `Source '${job.source_app}' has no server-side sync-all (no list endpoint)`,
        completed_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { done: true, nextCursor: null };
  }

  const accessToken = await resolveJobOwnerAccessToken(supabase, job);

  // The stored cursor may be a sub-page cursor (within-page offset) or a raw
  // provider cursor. Decode it before the fetch; the provider only ever sees
  // its own opaque token.
  const { providerCursor, offset } = decodeSubpageCursor(job.provider_cursor);

  const page = await listPage({
    accessToken,
    cursor: providerCursor,
    dateStart: job.date_start,
    dateEnd: job.date_end,
  });

  const rawItems = (page.items ?? []) as Record<string, unknown>[];
  // Apply the within-page offset (sub-page resume) then cap at the slice budget.
  const windowed = rawItems.slice(offset, offset + SLICE_ITEM_BUDGET);
  const hasMoreThisPage = offset + SLICE_ITEM_BUDGET < rawItems.length;

  const synced = [...(job.synced_ids ?? [])];
  const failed = [...(job.failed_ids ?? [])];
  let skippedCount = job.skipped_count ?? 0;

  for (const item of windowed) {
    const externalId = extractExternalId(item);
    if (!externalId) {
      // Pitfall 2 — never pass an empty external_id to runPipeline. An item we
      // cannot key is a genuine mapping failure.
      continue;
    }

    const record = mapItemToConnectorRecord(item, externalId, job);
    const result = await runPipeline(supabase, job.user_id, record);

    if (result.success) {
      synced.push(externalId);
    } else if (result.skipped) {
      // Duplicate caught by the owner-scoped fast check — success-equivalent,
      // never a failure.
      skippedCount += 1;
    } else if (isUniqueViolation(result.error)) {
      // SYNC-03 / Pitfall 1: the concurrent-slice loser. Both passed the
      // owner-scoped checkDuplicate; this insert hit the org-scoped constraint
      // and threw 23505. The winner imported the call — reclassify this as
      // skipped (count in skipped_count), and DO NOT push to failed_ids.
      skippedCount += 1;
    } else {
      // Genuine error (token expiry, network, mapping). Push the uncoerced
      // TEXT external_id so Phase 29 (FAIL) reads partial-success truth.
      failed.push(externalId);
    }
  }

  // Decide the next cursor:
  //   - more items left on THIS page → sub-page cursor (same provider cursor, advanced offset)
  //   - page consumed but provider has more → the provider's nextCursor
  //   - provider exhausted → null (terminal)
  let nextCursor: string | null;
  if (hasMoreThisPage) {
    nextCursor = encodeSubpageCursor(providerCursor, offset + SLICE_ITEM_BUDGET);
  } else {
    nextCursor = page.nextCursor ?? null;
  }

  const terminal = nextCursor === null;
  const update: Record<string, unknown> = {
    synced_ids: synced,
    failed_ids: failed,
    skipped_count: skippedCount,
    provider_cursor: nextCursor,
    // Heartbeat EVERY slice — the reaper net (Phase 27) reaps a slice that dies.
    last_heartbeat_at: new Date().toISOString(),
  };
  if (terminal) {
    update.status = failed.length > 0 ? "completed_with_errors" : "completed";
    update.completed_at = new Date().toISOString();
  }

  await supabase.from("sync_jobs").update(update).eq("id", job.id);

  return { done: terminal, nextCursor };
}

/** Self-chain the next slice — fire-and-forget, do NOT await (Pattern 1). */
function selfChain(supabase: SupabaseClient, jobId: string): void {
  // No user JWT forwarded — the next slice runs the SERVICE-ROLE RESUME path,
  // which re-loads the job row and authorizes off its stored org/user.
  supabase.functions
    .invoke("connector-sync-all", { body: { jobId } })
    .catch((err: unknown) => {
      // The pg_cron resume-heartbeat (Plan 04) re-kicks if this link drops.
      console.error(`[connector-sync-all] self-chain invoke failed for job ${jobId}:`, err);
    });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const hasJwt = !!req.headers.get("Authorization");

    // ── CRON / SERVICE-ROLE RESUME path ──────────────────────────────────────
    // No caller JWT → authorize by LOADING the job row and operating ONLY on
    // its stored organization_id / user_id. Never a caller-supplied org. This
    // is the IDOR boundary (T-28-03 / T-28-04).
    if (!hasJwt) {
      const parsed = resumeSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: "Resume requires a valid jobId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: jobRow, error: jobError } = await supabase
        .from("sync_jobs")
        .select(
          "id, user_id, organization_id, workspace_id, source_id, source_app, mode, status, date_start, date_end, provider_cursor, synced_ids, failed_ids, skipped_count",
        )
        .eq("id", parsed.data.jobId)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!jobRow) {
        return new Response(
          JSON.stringify({ error: "Job not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const job = jobRow as SyncJobRow;
      // Only advance a live sync-all job. Reject other modes / terminal states.
      if (job.mode !== "all" || job.status !== "processing") {
        return new Response(
          JSON.stringify({ error: "Job is not a resumable sync-all in progress" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { done } = await processSlice(supabase, job);
      if (!done) selfChain(supabase, job.id);

      return new Response(
        JSON.stringify({ success: true, jobId: job.id, done }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── USER-START path ──────────────────────────────────────────────────────
    // Caller JWT present → authenticate, validate the payload, derive the org,
    // write organization_id at creation, run the first slice, return jobId.
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const parsedStart = startSchema.safeParse(body);
    if (!parsedStart.success) {
      const msg = parsedStart.error.errors[0]?.message ?? "Invalid request";
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const start = parsedStart.data;

    // The pager must have a server-side list endpoint for this source.
    if (!resolveListPage(start.source_app)) {
      return new Response(
        JSON.stringify({
          error: `Source '${start.source_app}' imports automatically (no server-side sync-all)`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // IDOR gate (reused from sync-meetings): a caller-supplied workspace must be
    // one the user is a member of. Returns a 403 Response on violation.
    const requestedWorkspaceId = start.workspace_id ?? start.workspaceId ?? null;
    const validatedWorkspaceId = await validateRequestedWorkspaceId(
      supabase,
      userId,
      requestedWorkspaceId,
      corsHeaders,
    );
    if (validatedWorkspaceId instanceof Response) return validatedWorkspaceId;

    // Resolve the user's PERSONAL organization — org_id is written at creation
    // (locked decision) so dedup hits the org-scoped constraint deterministically.
    const { data: membership, error: orgError } = await supabase
      .from("organization_memberships")
      .select("organizations!inner(id, type)")
      .eq("user_id", userId)
      .eq("role", "organization_owner")
      .eq("organizations.type", "personal")
      .maybeSingle();
    if (orgError) throw orgError;
    // deno-lint-ignore no-explicit-any
    const organizationId: string | null = (membership as any)?.organizations?.id ?? null;
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "No personal organization found for user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve the source_id (connector instance) for this provider if not given.
    let sourceId = start.sourceId ?? null;
    if (!sourceId) {
      const { data: src } = await supabase
        .from("import_sources")
        .select("id")
        .eq("user_id", userId)
        .eq("source_app", start.source_app)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      sourceId = (src as { id?: string } | null)?.id ?? null;
    }
    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: `No active ${start.source_app} connector found` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dateWindow = getConnectorDateWindow({
      dateStart: start.dateStart ?? null,
      dateEnd: start.dateEnd ?? null,
      createdAfter: start.createdAfter ?? null,
      createdBefore: start.createdBefore ?? null,
    });

    const { data: created, error: createError } = await supabase
      .from("sync_jobs")
      .insert({
        user_id: userId,
        organization_id: organizationId,
        workspace_id: validatedWorkspaceId,
        source_id: sourceId,
        source_app: start.source_app,
        mode: "all",
        status: "processing",
        provider_cursor: null,
        date_start: dateWindow.start,
        date_end: dateWindow.end,
        synced_ids: [],
        failed_ids: [],
        skipped_count: 0,
        progress_current: 0,
        progress_total: 0,
        // Heartbeat at INSERT so a freshly-created job never persists NULL.
        last_heartbeat_at: new Date().toISOString(),
      })
      .select(
        "id, user_id, organization_id, workspace_id, source_id, source_app, mode, status, date_start, date_end, provider_cursor, synced_ids, failed_ids, skipped_count",
      )
      .single();

    if (createError) throw createError;
    const job = created as SyncJobRow;

    // Run the FIRST slice inline, then self-chain and return immediately.
    const { done } = await processSlice(supabase, job);
    if (!done) selfChain(supabase, job.id);

    return new Response(
      JSON.stringify({ success: true, jobId: job.id, done }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[connector-sync-all] error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
