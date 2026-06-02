/**
 * fathom-refresh — Phase 40 Fathom Re-import / Overwrite.
 *
 * Force-refresh a single Fathom call. Updates title/transcript/summary/duration
 * from Fathom; PRESERVES UUID, org, owner, workspace_entries, folder_assignments,
 * call_tag_assignments, recordings.created_at.
 *
 * Deploy: `supabase functions deploy fathom-refresh --use-api`
 *
 * Env vars required:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
 *   - FATHOM_OAUTH_CLIENT_ID, FATHOM_OAUTH_CLIENT_SECRET (token refresh)
 *   - OAUTH_ENCRYPTION_KEY (optional; if set, reads tokens via decrypt RPC)
 *
 * Errors:
 *   - 401 UNAUTHORIZED — missing/invalid JWT
 *   - 400 BAD_REQUEST — missing/invalid recording_id
 *   - 404 RECORDING_NOT_FOUND — recording doesn't exist or not owned
 *   - 404 FATHOM_CALL_NOT_FOUND — Fathom API could not find the call
 *   - 400 FATHOM_NO_LEGACY_ID — recording has no legacy_recording_id (shouldn't happen)
 *   - 400 NOT_A_FATHOM_CALL — source_app !== 'fathom'
 *   - 404 NO_FATHOM_SOURCE — user has no active Fathom import_source
 *   - 401 FATHOM_AUTH_EXPIRED — refresh token rejected
 *   - 429 FATHOM_RATE_LIMITED — Fathom returned 429 after retries
 *   - 503 FATHOM_TEMPORARILY_UNAVAILABLE — Fathom returned transient upstream errors after retries
 *   - 500 INTERNAL — anything else
 */

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { FathomClient } from "../_shared/fathom-client.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getDecryptedOAuthTokens } from "../_shared/oauth-encrypt.ts";

interface ResolvedCreds {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  apiKey: string | null;
  sourceId: string;
}

interface FathomTranscriptSegment {
  speaker?: { display_name?: string };
  text?: string;
  timestamp?: string;
}

function friendlyMessageForError(code: string): string {
  switch (code) {
    case "BAD_REQUEST":
      return "Refresh needs a CallVault recording UUID.";
    case "RECORDING_NOT_FOUND":
      return "Couldn't find that CallVault recording. Refresh the page and try again.";
    case "NOT_A_FATHOM_CALL":
      return "This is not a Fathom call, so it cannot be refreshed.";
    case "FATHOM_NO_LEGACY_ID":
      return "This Fathom recording is missing its provider ID, so it cannot be refreshed.";
    case "NO_FATHOM_SOURCE":
      return "No active Fathom connection found. Connect Fathom, then refresh again.";
    case "FATHOM_AUTH_EXPIRED":
      return "Fathom auth expired. Reconnect Fathom, then refresh again.";
    case "FATHOM_RATE_LIMITED":
      return "Fathom is rate-limiting refreshes. Try again in a minute.";
    case "FATHOM_TEMPORARILY_UNAVAILABLE":
      return "Fathom is temporarily unavailable. Try refresh again in a minute.";
    case "FATHOM_CALL_NOT_FOUND":
      return "Fathom could not find this call through its API. Open the Fathom link to confirm access, then reconnect Fathom if it still opens.";
    default:
      return "Fathom refresh hit a server error. Try again, then contact support if it repeats.";
  }
}

function isFathomTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function extractFathomNumericIds(...values: Array<unknown>): number[] {
  const ids = new Set<number>();

  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      ids.add(value);
      continue;
    }
    if (typeof value !== "string") continue;

    const directId = Number(value);
    if (Number.isInteger(directId) && directId > 0) {
      ids.add(directId);
      continue;
    }

    const urlMatch = value.match(/fathom\.video\/calls\/(\d+)/i);
    if (urlMatch?.[1]) {
      const urlId = Number(urlMatch[1]);
      if (Number.isInteger(urlId) && urlId > 0) ids.add(urlId);
    }
  }

  return [...ids];
}

async function fetchRecordingContent(
  authHeaders: Record<string, string>,
  recordingId: number,
): Promise<{
  transcript: FathomTranscriptSegment[];
  default_summary: unknown;
}> {
  const [summaryResponse, transcriptResponse] = await Promise.all([
    FathomClient.fetchWithRetry(
      `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`,
      { headers: authHeaders, maxRetries: 3 },
    ),
    FathomClient.fetchWithRetry(
      `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`,
      { headers: authHeaders, maxRetries: 3 },
    ),
  ]);

  if (summaryResponse.status === 429 || transcriptResponse.status === 429) {
    throw new Error("FATHOM_RATE_LIMITED");
  }
  if (
    isFathomTransientStatus(summaryResponse.status) ||
    isFathomTransientStatus(transcriptResponse.status)
  ) {
    throw new Error("FATHOM_TEMPORARILY_UNAVAILABLE");
  }
  if (summaryResponse.status === 401 || transcriptResponse.status === 401) {
    throw new Error("FATHOM_AUTH_EXPIRED");
  }

  const summaryData = summaryResponse.ok
    ? await summaryResponse.json()
    : { summary: null };
  const transcriptData = transcriptResponse.ok
    ? await transcriptResponse.json()
    : { transcript: [] };

  return {
    transcript: (transcriptData.transcript as FathomTranscriptSegment[]) || [],
    default_summary: summaryData.summary || null,
  };
}

async function withRecordingContent(
  authHeaders: Record<string, string>,
  meeting: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const recordingId = Number(meeting.recording_id);
  if (!Number.isInteger(recordingId) || recordingId <= 0) return meeting;

  const content = await fetchRecordingContent(authHeaders, recordingId);
  return {
    ...meeting,
    transcript: content.transcript,
    default_summary: content.default_summary,
  };
}

async function findFathomSource(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ sourceId: string } | null> {
  const { data, error } = await supabase
    .from("import_sources")
    .select("id")
    .eq("user_id", userId)
    .eq("source_app", "fathom")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { sourceId: data.id as string };
}

async function resolveCredentials(
  supabase: SupabaseClient,
  sourceId: string,
  userId: string,
): Promise<ResolvedCreds> {
  // Phase 28-03 fix (#294): previous code called `decrypt_oauth_tokens`
  // RPC which doesn't exist in prod (only `get_decrypted_oauth_tokens`),
  // then fell back to a raw oauth_access_token SELECT — which returns
  // PGP-armored ciphertext for encrypted rows and got 401 from Fathom.
  // Route through the canonical helper instead; it uses the correct RPC
  // name and has plaintext-fallback baked in for older rows.
  const decrypted = await getDecryptedOAuthTokens(
    supabase as unknown as ReturnType<typeof createClient>,
    sourceId,
    userId,
  );
  const { data: src, error } = await supabase
    .from("import_sources")
    .select("fathom_api_key")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Source credentials missing");

  return {
    accessToken: decrypted.access_token,
    refreshToken: decrypted.refresh_token,
    expiresAt: decrypted.token_expires,
    apiKey: src?.fathom_api_key ?? null,
    sourceId,
  };
}

async function refreshIfExpired(
  supabase: SupabaseClient,
  sourceId: string,
  creds: ResolvedCreds,
): Promise<string> {
  const now = Date.now();
  const buffer = 5 * 60_000;
  if (creds.expiresAt && creds.expiresAt - buffer > now && creds.accessToken) {
    return creds.accessToken;
  }
  if (!creds.refreshToken) {
    if (creds.apiKey) return "";
    throw new Error("FATHOM_AUTH_EXPIRED");
  }

  const clientId = Deno.env.get("FATHOM_OAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("FATHOM_OAUTH_CLIENT_SECRET")!;
  const tokenResponse = await fetch(
    "https://fathom.video/external/v1/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: creds.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  );
  if (!tokenResponse.ok) {
    throw new Error("FATHOM_AUTH_EXPIRED");
  }
  const tokens = await tokenResponse.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  await supabase
    .from("import_sources")
    .update({
      oauth_access_token: tokens.access_token,
      oauth_refresh_token: tokens.refresh_token,
      oauth_token_expires: expiresAt,
    })
    .eq("id", sourceId);

  return tokens.access_token;
}

async function fetchMeetingByRecordingId(
  authHeaders: Record<string, string>,
  recordingIds: number[],
  knownStartTime: string | null,
  fallback: {
    title: string | null;
    recordingStartTime: string | null;
    recordingEndTime?: string | null;
    fathomUrl?: string | null;
    fathomShareUrl?: string | null;
    recordedByName?: string | null;
    recordedByEmail?: string | null;
    calendarInvitees?: unknown;
  },
): Promise<Record<string, unknown> | null> {
  // Strategy A: direct recording_id filter. Keep this metadata-only:
  // include_summary/include_transcript are unavailable for OAuth apps, so
  // transcript and summary are fetched via /recordings/{id}/... below.
  for (const recordingId of recordingIds) {
    const url = new URL("https://api.fathom.ai/external/v1/meetings");
    url.searchParams.append("limit", "1");
    url.searchParams.append("recording_id", String(recordingId));

    const response = await FathomClient.fetchWithRetry(url.toString(), {
      headers: authHeaders,
      maxRetries: 3,
    });
    if (response.status === 429) {
      throw new Error("FATHOM_RATE_LIMITED");
    }
    if (isFathomTransientStatus(response.status)) {
      throw new Error("FATHOM_TEMPORARILY_UNAVAILABLE");
    }
    if (response.ok) {
      const data = await response.json();
      const items = (data.items as Array<Record<string, unknown>>) || [];
      const match = items.find(
        (m) => Number(m.recording_id) === recordingId,
      );
      if (match) return await withRecordingContent(authHeaders, match);
    }
  }

  // Strategy B: direct recording endpoints. The meetings list endpoint can fail
  // to locate older/provider-migrated calls even when the recording URL still
  // exists. Direct endpoints prove the recording still exists and let refresh
  // update transcript/summary while preserving existing metadata fallbacks.
  for (const recordingId of recordingIds) {
    const [summaryResponse, transcriptResponse] = await Promise.all([
      FathomClient.fetchWithRetry(
        `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`,
        { headers: authHeaders, maxRetries: 3 },
      ),
      FathomClient.fetchWithRetry(
        `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`,
        { headers: authHeaders, maxRetries: 3 },
      ),
    ]);

    if (summaryResponse.status === 429 || transcriptResponse.status === 429) {
      throw new Error("FATHOM_RATE_LIMITED");
    }
    if (
      isFathomTransientStatus(summaryResponse.status) ||
      isFathomTransientStatus(transcriptResponse.status)
    ) {
      throw new Error("FATHOM_TEMPORARILY_UNAVAILABLE");
    }
    if (summaryResponse.status === 401 || transcriptResponse.status === 401) {
      throw new Error("FATHOM_AUTH_EXPIRED");
    }

    if (summaryResponse.ok || transcriptResponse.ok) {
      const summaryData = summaryResponse.ok
        ? await summaryResponse.json()
        : { summary: null };
      const transcriptData = transcriptResponse.ok
        ? await transcriptResponse.json()
        : { transcript: [] };

      return {
        recording_id: recordingId,
        title: fallback.title || "Untitled Call",
        recording_start_time:
          fallback.recordingStartTime || new Date().toISOString(),
        recording_end_time: fallback.recordingEndTime || null,
        url: fallback.fathomUrl || null,
        share_url: fallback.fathomShareUrl || null,
        recorded_by:
          fallback.recordedByName || fallback.recordedByEmail
            ? {
                name: fallback.recordedByName || undefined,
                email: fallback.recordedByEmail || undefined,
              }
            : undefined,
        calendar_invitees: fallback.calendarInvitees || null,
        transcript: transcriptData.transcript || [],
        default_summary: summaryData.summary || null,
      };
    }
  }

  // Strategy C: paginate around known start_time (fallback when API rejects recording_id filter)
  if (knownStartTime) {
    const start = new Date(knownStartTime);
    const oneDayBefore = new Date(
      start.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();

    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const url = new URL("https://api.fathom.ai/external/v1/meetings");
      url.searchParams.append("limit", "50");
      url.searchParams.append("created_after", oneDayBefore);
      if (cursor) url.searchParams.append("cursor", cursor);

      const response = await FathomClient.fetchWithRetry(url.toString(), {
        headers: authHeaders,
        maxRetries: 3,
      });
      if (response.status === 429) {
        throw new Error("FATHOM_RATE_LIMITED");
      }
      if (isFathomTransientStatus(response.status)) {
        throw new Error("FATHOM_TEMPORARILY_UNAVAILABLE");
      }
      if (!response.ok) {
        break;
      }
      const data = await response.json();
      const items = (data.items as Array<Record<string, unknown>>) || [];
      const match = items.find((m) =>
        recordingIds.includes(Number(m.recording_id))
      );
      if (match) return await withRecordingContent(authHeaders, match);
      cursor = data.next_cursor as string | undefined;
      if (!cursor) break;
    }
  }

  return null;
}

function normalizeMeeting(meeting: Record<string, unknown>): {
  title: string;
  fullTranscript: string;
  summary: string | null;
  durationSec: number | undefined;
  recordingEndTime: string | null;
  fathomUrl: string | null;
  fathomShareUrl: string | null;
  recordedByName: string | null;
  recordedByEmail: string | null;
  calendarInvitees: unknown;
  recordingStartTime: string;
} {
  const title =
    (meeting.title as string) ||
    (meeting.meeting_title as string) ||
    "Untitled Call";
  const transcript = (meeting.transcript as FathomTranscriptSegment[]) || [];
  const consolidated: string[] = [];
  let curSpeaker: string | null = null;
  let curTs: string | null = null;
  let curTexts: string[] = [];
  transcript.forEach((seg, idx) => {
    const name = seg.speaker?.display_name || "Unknown";
    if (name !== curSpeaker) {
      if (curSpeaker && curTexts.length) {
        consolidated.push(
          `[${curTs || "00:00:00"}] ${curSpeaker}: ${curTexts.join(" ")}`,
        );
      }
      curSpeaker = name;
      curTs = seg.timestamp || "00:00:00";
      curTexts = [seg.text || ""];
    } else {
      curTexts.push(seg.text || "");
    }
    if (idx === transcript.length - 1 && curTexts.length) {
      consolidated.push(
        `[${curTs || "00:00:00"}] ${curSpeaker}: ${curTexts.join(" ")}`,
      );
    }
  });
  const fullTranscript = consolidated.join("\n\n");

  const summary =
    (meeting.default_summary as { markdown_formatted?: string } | undefined)
      ?.markdown_formatted || null;

  const start = new Date(meeting.recording_start_time as string);
  const end = meeting.recording_end_time
    ? new Date(meeting.recording_end_time as string)
    : null;
  const durationSec = end
    ? Math.floor((end.getTime() - start.getTime()) / 1000)
    : undefined;

  const recordedBy = meeting.recorded_by as
    | { name?: string; email?: string }
    | undefined;

  return {
    title,
    fullTranscript,
    summary,
    durationSec,
    recordingEndTime: (meeting.recording_end_time as string) || null,
    fathomUrl: (meeting.url as string) || null,
    fathomShareUrl: (meeting.share_url as string) || null,
    recordedByName: recordedBy?.name || null,
    recordedByEmail: recordedBy?.email || null,
    calendarInvitees: meeting.calendar_invitees || null,
    recordingStartTime: meeting.recording_start_time as string,
  };
}

interface RefreshResult {
  success: true;
  recording_id: string;
  legacy_recording_id: number;
  title: string;
  duration: number | null;
  synced_at: string;
}

async function refreshOne(
  supabase: SupabaseClient,
  userId: string,
  recordingUuid: string,
): Promise<RefreshResult> {
  // 1. Verify ownership + read existing row
  const { data: rec, error: recErr } = await supabase
    .from("recordings")
    .select(
      "id, legacy_recording_id, organization_id, owner_user_id, source_app, source_call_id, title, created_at, recording_start_time, recording_end_time, source_metadata",
    )
    .eq("id", recordingUuid)
    .maybeSingle();
  if (recErr) throw new Error("INTERNAL");
  if (!rec) {
    const e = new Error("RECORDING_NOT_FOUND");
    (e as Error & { httpStatus?: number }).httpStatus = 404;
    throw e;
  }
  if (rec.owner_user_id !== userId) {
    // Match RLS behavior — 404 not 403 (prevents existence-leak)
    const e = new Error("RECORDING_NOT_FOUND");
    (e as Error & { httpStatus?: number }).httpStatus = 404;
    throw e;
  }
  if (rec.source_app !== "fathom") {
    const e = new Error("NOT_A_FATHOM_CALL");
    (e as Error & { httpStatus?: number }).httpStatus = 400;
    throw e;
  }
  if (!rec.legacy_recording_id) {
    const e = new Error("FATHOM_NO_LEGACY_ID");
    (e as Error & { httpStatus?: number }).httpStatus = 400;
    throw e;
  }

  // 2. Find user's active Fathom source
  const src = await findFathomSource(supabase, userId);
  if (!src) {
    const e = new Error("NO_FATHOM_SOURCE");
    (e as Error & { httpStatus?: number }).httpStatus = 404;
    throw e;
  }

  // 3. Resolve + refresh OAuth tokens
  const creds = await resolveCredentials(supabase, src.sourceId, userId);
  const accessToken = await refreshIfExpired(supabase, src.sourceId, creds);
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) authHeaders["Authorization"] = `Bearer ${accessToken}`;
  else if (creds.apiKey) authHeaders["X-Api-Key"] = creds.apiKey;

  // 4. Fetch latest meeting from Fathom
  const sourceMetadata = (rec.source_metadata as Record<string, unknown> | null) || {};
  const candidateRecordingIds = extractFathomNumericIds(
    rec.legacy_recording_id,
    rec.source_call_id,
    sourceMetadata.fathom_call_id,
    sourceMetadata.fathom_url,
  );

  const meeting = await fetchMeetingByRecordingId(
    authHeaders,
    candidateRecordingIds,
    rec.recording_start_time as string | null,
    {
      title: rec.title as string | null,
      recordingStartTime: rec.recording_start_time as string | null,
      recordingEndTime: rec.recording_end_time as string | null,
      fathomUrl: sourceMetadata.fathom_url as string | null,
      fathomShareUrl: sourceMetadata.fathom_share_url as string | null,
      recordedByName: sourceMetadata.recorded_by_name as string | null,
      recordedByEmail: sourceMetadata.recorded_by_email as string | null,
      calendarInvitees: sourceMetadata.calendar_invitees,
    },
  );
  if (!meeting) {
    const e = new Error("FATHOM_CALL_NOT_FOUND");
    (e as Error & { httpStatus?: number }).httpStatus = 404;
    throw e;
  }

  // 5. Normalize
  const n = normalizeMeeting(meeting);
  const syncedAt = new Date().toISOString();

  // 6. Merge source_metadata — keep existing keys, overwrite Fathom-managed ones
  const mergedMeta: Record<string, unknown> = {
    ...sourceMetadata,
    fathom_call_id: Number(meeting.recording_id) || rec.legacy_recording_id,
    fathom_url: n.fathomUrl,
    fathom_share_url: n.fathomShareUrl,
    recorded_by_name: n.recordedByName,
    recorded_by_email: n.recordedByEmail,
    calendar_invitees: n.calendarInvitees,
    summary: n.summary,
    import_source: "fathom-refresh",
    synced_at: syncedAt,
  };

  // 7. UPDATE recordings — preservation invariants enforced by NOT setting those columns
  const { error: upErr } = await supabase
    .from("recordings")
    .update({
      title: n.title,
      full_transcript: n.fullTranscript,
      summary: n.summary,
      duration: n.durationSec ?? null,
      recording_end_time: n.recordingEndTime,
      synced_at: syncedAt,
      source_metadata: mergedMeta,
    })
    .eq("id", recordingUuid)
    .eq("owner_user_id", userId);
  if (upErr) {
    console.error("[fathom-refresh] update failed:", upErr);
    throw new Error("INTERNAL");
  }

  // 8. Re-upsert mirror
  const { error: rawErr } = await supabase.from("fathom_raw_calls").upsert(
    {
      recording_id: rec.legacy_recording_id,
      user_id: userId,
      import_source_id: src.sourceId,
      mirror_version: 1,
      canonical_recording_id: recordingUuid,
      title: n.title,
      created_at: (meeting.created_at as string) || rec.created_at,
      recording_start_time: n.recordingStartTime,
      recording_end_time: n.recordingEndTime,
      url: n.fathomUrl,
      share_url: n.fathomShareUrl,
      full_transcript: n.fullTranscript,
      summary: n.summary,
      recorded_by_name: n.recordedByName,
      recorded_by_email: n.recordedByEmail,
      calendar_invitees: n.calendarInvitees,
      synced_at: syncedAt,
    },
    { onConflict: "recording_id,user_id" },
  );
  if (rawErr) {
    console.error(
      "[fathom-refresh] mirror upsert error (non-blocking):",
      rawErr,
    );
  }

  return {
    success: true,
    recording_id: recordingUuid,
    legacy_recording_id: rec.legacy_recording_id as number,
    title: n.title,
    duration: n.durationSec ?? null,
    synced_at: syncedAt,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // Parse body
    const body = await req.json().catch(() => ({}));
    const recordingId = body.recording_id as string | undefined;
    if (!recordingId || typeof recordingId !== "string") {
      return new Response(
        JSON.stringify({
          error: "BAD_REQUEST",
          message: "recording_id (uuid) required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = await refreshOne(supabase, userId, recordingId);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "INTERNAL";
    const httpStatus =
      (error as Error & { httpStatus?: number }).httpStatus ??
      (msg === "FATHOM_RATE_LIMITED"
        ? 429
        : msg === "FATHOM_AUTH_EXPIRED"
          ? 401
          : msg === "FATHOM_TEMPORARILY_UNAVAILABLE"
            ? 503
            : msg === "FATHOM_CALL_NOT_FOUND"
              ? 404
              : 500);
    console.error("[fathom-refresh] handler error:", error);
    const headers: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };
    if (httpStatus === 429) headers["Retry-After"] = "30";
    return new Response(JSON.stringify({ error: msg, message: friendlyMessageForError(msg) }), {
      status: httpStatus,
      headers,
    });
  }
});
