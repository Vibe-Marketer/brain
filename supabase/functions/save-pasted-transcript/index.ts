// Phase 24: user-paste save endpoint. NEVER fetches from fathom.video — user pastes the transcript themselves.
//
// Endpoint: POST /functions/v1/save-pasted-transcript
// Auth: Supabase JWT (Authorization: Bearer <token>)
//
// Body (Zod-validated):
//   {
//     share_url?: string,          // optional fathom.video share URL
//     raw_transcript: string,      // required — pasted text, min 20 chars
//     title?: string,              // optional override
//     recorded_at?: string,        // optional ISO 8601 override
//     attendees?: string[],        // optional override
//     organization_id: string,     // required — UUID of active workspace's organization
//   }
//
// Response on success: { success: true, data: { recording_id: string, action: 'created' | 'updated' } }
// Response on error:   { error: string, details?: any } with appropriate 4xx/5xx status
//
// Dedup: when share_token is present, upsert keyed on (organization_id, share_token).
//        Implemented as explicit select-then-insert/update so the action label is deterministic.
//
// Hard rule (D-06): zero outbound HTTP. Only the Supabase client makes network calls.
//                   No fetch/axios to fathom.video anywhere in this file.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  parseFathomCopyFormat,
  extractShareToken,
} from "../_shared/fathom-transcript-parser.ts";
import {
  consolidateBySpeaker,
  parseVTTWithMetadata,
  timestampToSeconds,
} from "../_shared/vtt-parser.ts";
import { isSrtContent, parseSRT, srtTimestampToSeconds } from "../_shared/srt-parser.ts";
import { isOtterContent, parseOtter } from "../_shared/otter-parser.ts";
import { isLoomUrl, extractLoomShareToken, parseLoomTranscript } from "../_shared/loom-parser.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { runPipeline } from "../_shared/connector-pipeline.ts";

const FATHOM_URL_RE = /^https?:\/\/(www\.)?fathom\.video\//;

// MAN-02: extended to include SRT and Otter.ai transcript formats
type ManualTranscriptSourceApp = "fathom-paste" | "zoom" | "srt" | "otter" | "loom" | "file-upload";
const UNKNOWN_SPEAKER = "Unknown Speaker";

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor((totalSec % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSec % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const inputSchema = z.object({
  source_app: z.enum(["fathom-paste", "zoom", "srt", "otter", "loom", "file-upload"]).optional(),
  share_url: z.string().trim().max(2048).optional(),
  source_url: z.string().trim().url().max(2048).optional(),
  raw_transcript: z
    .string()
    .min(20, "Transcript appears too short to be meaningful")
    .max(5_000_000, "Transcript exceeds maximum size of 5MB"),
  title: z.string().trim().max(500).optional(),
  recorded_at: z.string().datetime({ offset: true }).optional(),
  attendees: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  organization_id: z.string().uuid("organization_id must be a UUID"),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 2. Auth
    // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // 3. Parse + validate input
    const rawBody = await req.json().catch(() => ({}));
    const validation = inputSchema.safeParse(rawBody);
    if (!validation.success) {
      const errorMessage =
        validation.error.errors[0]?.message || "Invalid input";
      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const {
      source_app,
      share_url,
      source_url,
      raw_transcript,
      title: titleOverride,
      recorded_at: recordedAtOverride,
      attendees: attendeesOverride,
      organization_id,
    } = validation.data;
    const sourceUrl = source_url ?? share_url;
    const sourceApp = inferManualSourceApp({
      explicitSourceApp: source_app,
      sourceUrl,
      rawTranscript: raw_transcript,
    });

    // 4. T-24-08: validate share_url is a fathom.video URL if provided.
    //    Defense-in-depth: even though we never fetch it server-side, we DO render it
    //    as a `window.open` target on the recording detail page, so an open-redirect
    //    via storage would expose users to a click-to-malicious-site risk.
    if (sourceApp === "fathom-paste" && sourceUrl && !FATHOM_URL_RE.test(sourceUrl)) {
      return new Response(
        JSON.stringify({ error: "Fathom imports require a fathom.video source link" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. T-24-02: verify user is a member of the requested organization.
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("id, role")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "[save-pasted-transcript] Error checking org membership:",
        membershipError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to verify workspace access" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of the requested workspace" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 6. Parse the transcript (D-08, D-09, D-10).
    let normalized: Awaited<ReturnType<typeof normalizeManualTranscript>>;
    try {
      normalized = await normalizeManualTranscript({
        sourceApp,
        rawTranscript: raw_transcript,
        titleOverride,
        recordedAtOverride,
        attendeesOverride,
        sourceUrl,
      });
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error:
            parseError instanceof Error
              ? parseError.message
              : "Could not parse transcript",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const shareToken =
      sourceApp === "fathom-paste" && sourceUrl ? extractShareToken(sourceUrl) 
      : sourceApp === "loom" && sourceUrl ? extractLoomShareToken(sourceUrl)
      : null;

    // 7. Build payload (D-02, D-04).
    const sourceMetadata = {
      external_id: normalized.externalId,
      share_url: sourceUrl ?? null,
      source_url: sourceUrl ?? null,
      source_platform: sourceApp,
      import_method: "manual",
      parse_status: normalized.parseStatus,
      attendees: normalized.attendees,
      calendar_invitees: normalized.calendarInvitees,
      transcript_speaker_names: normalized.speakerNames,
      duration_seconds: normalized.duration,
      paste_source: normalized.pasteSource,
      pasted_at: new Date().toISOString(),
      recorded_by_name: normalized.speakerNames[0] ?? null,
      recorded_by_email: null,
    };

    const payload = {
      organization_id,
      owner_user_id: userId,
      title: normalized.title,
      full_transcript: normalized.fullTranscript,
      summary: null,
      source_app: sourceApp,
      source_call_id: normalized.externalId, // also populates the existing global dedup constraint
      source_metadata: sourceMetadata,
      transcript_segments: normalized.transcriptSegments,
      share_token: shareToken,
      recording_start_time: normalized.recordedAt,
      recording_end_time: normalized.recordingEndAt,
      duration: normalized.duration,
      global_tags: [] as string[],
    };

    // 8. Upsert (D-03). Explicit select-then-insert/update for deterministic action label.
    //    Look up an existing paste by (organization_id, share_token) when we
    //    have one; otherwise fall through to the shared connector pipeline.
    let existingId: string | null = null;
    if (shareToken) {
      const { data: existing, error: lookupError } = await supabase
        .from("recordings")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("share_token", shareToken)
        .maybeSingle();

      if (lookupError) {
        console.error(
          "[save-pasted-transcript] Existing-row lookup failed:",
          lookupError,
        );
        return new Response(
          JSON.stringify({ error: "Failed to check for existing transcript" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      existingId = existing?.id ?? null;
    }

    let recordingId: string;
    let action: "created" | "updated";

    if (existingId) {
      const { error: updateError } = await supabase
        .from("recordings")
        .update({
          title: payload.title,
          full_transcript: payload.full_transcript,
          source_metadata: payload.source_metadata,
          transcript_segments: payload.transcript_segments,
          recording_start_time: payload.recording_start_time,
          duration: payload.duration,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId);
      if (updateError) {
        console.error("[save-pasted-transcript] Update failed:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update transcript" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      recordingId = existingId;
      action = "updated";
    } else {
      // No existing row (either no shareToken, or shareToken didn't match):
      // route through the shared connector pipeline so manual transcripts land
      // in the same workspace/routing path as other imports.
      const result = await insertManualTranscriptThroughPipeline({
        supabase,
        userId,
        sourceApp,
        organizationId: organization_id,
        payload,
        sourceMetadata,
        normalized,
        corsHeaders,
      });
      if (result instanceof Response) return result;
      recordingId = result.recordingId;
      action = "created";
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { recording_id: recordingId, action },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // T-24-04: never echo back JWT, service key, or full request body.
    console.error("[save-pasted-transcript] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function insertManualTranscriptThroughPipeline({
  supabase,
  userId,
  sourceApp,
  organizationId,
  payload,
  sourceMetadata,
  normalized,
  corsHeaders,
}: {
  supabase: any;
  userId: string;
  sourceApp: ManualTranscriptSourceApp;
  organizationId: string;
  payload: {
    title: string;
    full_transcript: string;
    recording_start_time: string | null;
    recording_end_time: string | null;
    duration: number | null;
    transcript_segments: unknown;
    share_token: string | null;
  };
  sourceMetadata: Record<string, unknown>;
  normalized: Awaited<ReturnType<typeof normalizeManualTranscript>>;
  corsHeaders: Record<string, string>;
}): Promise<{ recordingId: string } | Response> {
  const result = await runPipeline(supabase, userId, {
    external_id: normalized.externalId,
    source_app: sourceApp,
    title: payload.title,
    full_transcript: payload.full_transcript,
    recording_start_time: payload.recording_start_time ?? new Date().toISOString(),
    recording_end_time: payload.recording_end_time ?? undefined,
    duration: payload.duration ?? undefined,
    organization_id: organizationId,
    source_metadata: sourceMetadata,
  });
  if (!result.success || !result.recordingId) {
    if (result.skipped) {
      return new Response(JSON.stringify({ error: "Transcript already imported" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[save-pasted-transcript] Pipeline insert failed:", result.error);
    return new Response(JSON.stringify({ error: "Failed to save transcript" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await supabase
    .from("recordings")
    .update({
      share_token: payload.share_token,
      transcript_segments: payload.transcript_segments,
      recording_end_time: normalized.recordingEndAt,
    })
    .eq("id", result.recordingId);

  if (updateError) {
    console.error("[save-pasted-transcript] Failed to backfill manual transcript columns:", updateError);
  }

  return { recordingId: result.recordingId };
}

interface NormalizeManualArgs {
  sourceApp: ManualTranscriptSourceApp;
  rawTranscript: string;
  titleOverride?: string;
  recordedAtOverride?: string;
  attendeesOverride?: string[];
  sourceUrl?: string;
}

async function normalizeManualTranscript(args: NormalizeManualArgs) {
  if (args.sourceApp === "zoom") return normalizeZoomVtt(args);
  if (args.sourceApp === "srt") return normalizeSrt(args);
  if (args.sourceApp === "otter") return normalizeOtter(args);
  if (args.sourceApp === "loom") return normalizeLoom(args);
  return normalizeFathomPaste(args);
}

async function normalizeZoomVtt({
  rawTranscript,
  titleOverride,
  recordedAtOverride,
  attendeesOverride,
  sourceUrl,
}: NormalizeManualArgs) {
  const parsed = parseVTTWithMetadata(rawTranscript);
  if (parsed.segments.length === 0) {
    return normalizeRawManualTranscript({
      sourceApp: "zoom",
      rawTranscript,
      titleOverride,
      recordedAtOverride,
      attendeesOverride,
      sourceUrl,
      pasteSource: "zoom-vtt",
      defaultTitle: "Untitled Zoom transcript",
    });
  }
  const consolidated = consolidateBySpeaker(parsed.segments);
  const fullTranscript = consolidated
    .map((seg) => {
      const timestamp = seg.start_time.split(".")[0] || "00:00:00";
      return `[${timestamp}] ${seg.speaker || UNKNOWN_SPEAKER}: ${seg.text}`;
    })
    .join("\n\n");
  const speakerNames = uniqueStrings(
    parsed.segments.map((segment) => segment.speaker).filter(Boolean) as string[],
  );
  const externalId = await stableManualExternalId("zoom-vtt", {
    sourceUrl,
    rawTranscript,
    title: titleOverride,
    recordedAt: recordedAtOverride,
  });

  const recordedAt =
    recordedAtOverride ??
    parsed.recorded_at ??
    inferDateFromText(titleOverride) ??
    new Date().toISOString();
  const recordingEndAt = addSeconds(recordedAt, parsed.duration_seconds);
  const attendees = attendeesOverride ?? speakerNames;

  return {
    externalId,
    title: titleOverride ?? parsed.title ?? "Untitled Zoom transcript",
    recordedAt,
    recordingEndAt,
    duration: parsed.duration_seconds,
    fullTranscript,
    attendees,
    calendarInvitees: buildCalendarInvitees(attendees, speakerNames),
    speakerNames,
    parseStatus: "parsed",
    pasteSource: "zoom-vtt",
    transcriptSegments: parsed.segments.map((segment) => ({
      start_ms: Math.round(timestampToSeconds(segment.start_time) * 1000),
      speaker: segment.speaker ?? UNKNOWN_SPEAKER,
      text: segment.text,
    })),
  };
}

// MAN-02: SRT transcript normalization path
async function normalizeSrt({
  rawTranscript,
  titleOverride,
  recordedAtOverride,
  attendeesOverride,
  sourceUrl,
}: NormalizeManualArgs) {
  const parsed = parseSRT(rawTranscript);
  if (parsed.segments.length === 0) {
    return normalizeRawManualTranscript({
      sourceApp: "srt",
      rawTranscript,
      titleOverride,
      recordedAtOverride,
      attendeesOverride,
      sourceUrl,
      pasteSource: "srt",
      defaultTitle: "Untitled SRT transcript",
    });
  }
  const speakerNames = uniqueStrings(
    parsed.segments.map((s) => s.speaker).filter(Boolean) as string[],
  );
  const fullTranscript = parsed.segments
    .map((s) => `[${s.start_time}] ${s.speaker ?? UNKNOWN_SPEAKER}: ${s.text}`)
    .join("\n\n");
  const externalId = await stableManualExternalId("srt", {
    sourceUrl,
    rawTranscript,
    title: titleOverride,
    recordedAt: recordedAtOverride,
  });
  const recordedAt =
    recordedAtOverride ??
    inferDateFromText(titleOverride) ??
    new Date().toISOString();
  const attendees = attendeesOverride ?? speakerNames;

  return {
    externalId,
    title: titleOverride ?? "Untitled SRT transcript",
    recordedAt,
    recordingEndAt: addSeconds(recordedAt, parsed.duration_seconds || null),
    duration: parsed.duration_seconds || null,
    fullTranscript,
    attendees,
    calendarInvitees: buildCalendarInvitees(attendees, speakerNames),
    speakerNames,
    parseStatus: "parsed",
    pasteSource: "srt",
    transcriptSegments: parsed.segments.map((s) => ({
      start_ms: Math.round(srtTimestampToSeconds(`${s.start_time},000`) * 1000),
      speaker: s.speaker ?? UNKNOWN_SPEAKER,
      text: s.text,
    })),
  };
}

// MAN-02: Otter.ai TXT transcript normalization path
async function normalizeOtter({
  rawTranscript,
  titleOverride,
  recordedAtOverride,
  attendeesOverride,
  sourceUrl,
}: NormalizeManualArgs) {
  const parsed = parseOtter(rawTranscript);
  const speakerNames = parsed.speakers;
  const fullTranscript = parsed.segments.length > 0
    ? parsed.segments
        .map((s) => `${s.speaker || UNKNOWN_SPEAKER}: ${s.text}`)
        .join("\n\n")
    : rawTranscript;
  const externalId = await stableManualExternalId("otter", {
    sourceUrl,
    rawTranscript,
    title: titleOverride ?? parsed.title,
    recordedAt: recordedAtOverride,
  });
  const recordedAt =
    recordedAtOverride ??
    inferDateFromText(titleOverride ?? parsed.title) ??
    new Date().toISOString();
  const attendees = attendeesOverride ?? speakerNames;

  return {
    externalId,
    title: titleOverride ?? parsed.title ?? "Untitled Otter transcript",
    recordedAt,
    recordingEndAt: null,
    duration: null,
    fullTranscript,
    attendees,
    calendarInvitees: buildCalendarInvitees(attendees, speakerNames),
    speakerNames,
    parseStatus: parsed.segments.length > 0 ? "parsed" : "raw",
    pasteSource: "otter",
    transcriptSegments: parsed.segments.length > 0
      ? parsed.segments.map((s, idx) => ({
          // Otter has no timestamps — use turn index as a proxy (ms offset = idx * 1000)
          start_ms: idx * 1000,
          speaker: s.speaker || UNKNOWN_SPEAKER,
          text: s.text,
        }))
      : null,
  };
}

async function normalizeLoom({
  rawTranscript,
  titleOverride,
  recordedAtOverride,
  attendeesOverride,
  sourceUrl,
}: NormalizeManualArgs) {
  const parsed = parseLoomTranscript(rawTranscript);
  const speakerNames = parsed.segments.length > 0 ? Array.from(new Set(parsed.segments.map(s => s.speaker))) : [];
  
  const lastSeg = parsed.segments.length > 0 ? parsed.segments[parsed.segments.length - 1] : null;
  const duration = lastSeg ? Math.ceil(lastSeg.start_ms / 1000) : null;
  
  const externalId = await stableManualExternalId("loom", {
    sourceUrl,
    rawTranscript,
    title: titleOverride,
    recordedAt: recordedAtOverride,
  });
  const recordedAt =
    recordedAtOverride ??
    inferDateFromText(titleOverride) ??
    new Date().toISOString();
  const attendees = attendeesOverride ?? speakerNames;
  
  const fullTranscript = parsed.segments.length > 0
    ? parsed.segments.map((seg) => `[${formatTimestamp(seg.start_ms)}] ${seg.speaker || UNKNOWN_SPEAKER}: ${seg.text}`).join("\n\n")
    : rawTranscript;

  return {
    externalId,
    title: titleOverride ?? "Untitled Loom video",
    recordedAt,
    recordingEndAt: null,
    duration,
    fullTranscript,
    attendees,
    calendarInvitees: buildCalendarInvitees(attendees, speakerNames),
    speakerNames,
    parseStatus: parsed.parse_status,
    pasteSource: "loom",
    transcriptSegments: parsed.segments.length > 0 ? parsed.segments : null,
  };
}

async function normalizeRawManualTranscript({
  sourceApp,
  rawTranscript,
  titleOverride,
  recordedAtOverride,
  attendeesOverride,
  sourceUrl,
  pasteSource,
  defaultTitle,
}: {
  sourceApp: ManualTranscriptSourceApp;
  rawTranscript: string;
  titleOverride?: string;
  recordedAtOverride?: string;
  attendeesOverride?: string[];
  sourceUrl?: string;
  pasteSource: string;
  defaultTitle: string;
}) {
  const recordedAt =
    recordedAtOverride ??
    inferDateFromText(titleOverride) ??
    new Date().toISOString();
  const attendees = attendeesOverride ?? [];
  const externalId = await stableManualExternalId(sourceApp, {
    sourceUrl,
    rawTranscript,
    title: titleOverride,
    recordedAt: recordedAtOverride,
  });

  return {
    externalId,
    title: titleOverride ?? defaultTitle,
    recordedAt,
    recordingEndAt: null,
    duration: null,
    fullTranscript: rawTranscript,
    attendees,
    calendarInvitees: buildCalendarInvitees(attendees, []),
    speakerNames: [],
    parseStatus: "raw",
    pasteSource,
    transcriptSegments: null,
  };
}

async function normalizeFathomPaste({
  sourceApp,
  rawTranscript,
  titleOverride,
  recordedAtOverride,
  attendeesOverride,
  sourceUrl,
}: NormalizeManualArgs) {
  const parsed = parseFathomCopyFormat(rawTranscript);
  const lastSeg =
    parsed.parse_status === "parsed" && parsed.segments.length > 0
      ? parsed.segments[parsed.segments.length - 1]
      : null;
  const duration = lastSeg ? Math.ceil(lastSeg.start_ms / 1000) : null;
  const recordedAt =
    recordedAtOverride ??
    parsed.recorded_at ??
    inferDateFromText(titleOverride ?? parsed.title) ??
    new Date().toISOString();
  const attendees = attendeesOverride ?? parsed.attendees;
  const fullTranscript =
    parsed.parse_status === "parsed" && parsed.segments.length > 0
      ? parsed.segments
          .map((seg) => `[${formatTimestamp(seg.start_ms)}] ${seg.speaker}: ${seg.text}`)
          .join("\n")
      : rawTranscript;
  const speakerNames =
    parsed.parse_status === "parsed"
      ? uniqueStrings(parsed.segments.map((segment) => segment.speaker))
      : [];
  const shareToken =
    sourceApp === "fathom-paste" && sourceUrl ? extractShareToken(sourceUrl) : null;

  return {
    externalId:
      shareToken ??
      await stableManualExternalId(sourceApp, {
        sourceUrl,
        rawTranscript,
        title: titleOverride ?? parsed.title,
        recordedAt: recordedAtOverride ?? parsed.recorded_at,
      }),
    title:
      titleOverride ??
      parsed.title ??
      (sourceApp === "fathom-paste" ? "Untitled Fathom transcript" : "Untitled pasted transcript"),
    recordedAt,
    recordingEndAt: addSeconds(recordedAt, duration),
    duration,
    fullTranscript,
    attendees,
    calendarInvitees: buildCalendarInvitees(attendees, speakerNames),
    speakerNames,
    parseStatus: parsed.parse_status,
    pasteSource: sourceApp === "fathom-paste" ? "fathom-share-link" : "manual-paste",
    transcriptSegments: parsed.parse_status === "parsed" ? parsed.segments : null,
  };
}

function inferManualSourceApp({
  explicitSourceApp,
  sourceUrl,
  rawTranscript,
}: {
  explicitSourceApp?: ManualTranscriptSourceApp;
  sourceUrl?: string;
  rawTranscript: string;
}): ManualTranscriptSourceApp {
  if (explicitSourceApp) return explicitSourceApp;
  // VTT check first (WEBVTT header or Zoom URL)
  if (/^\s*WEBVTT\b/i.test(rawTranscript) || /zoom\.us/i.test(sourceUrl ?? "")) return "zoom";
  // SRT: numeric cue index + comma-millisecond timestamp
  if (isSrtContent(rawTranscript)) return "srt";
  // Otter.ai TXT export
  if (isOtterContent(rawTranscript)) return "otter";
  if (isLoomUrl(sourceUrl)) return "loom";
  return "fathom-paste";
}

function addSeconds(startIso: string | null | undefined, seconds: number | null): string | null {
  if (!startIso || seconds == null) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + seconds * 1000).toISOString();
}

function buildCalendarInvitees(attendees: string[], speakerNames: string[]) {
  const speakerMap = new Map(speakerNames.map((name) => [name.toLowerCase(), name]));
  return uniqueStrings(attendees.length > 0 ? attendees : speakerNames).map((name) => {
    const matchedSpeaker = speakerMap.get(name.toLowerCase()) ?? name;
    return {
      name,
      email: null,
      matched_speaker_display_name: matchedSpeaker,
    };
  });
}

function inferDateFromText(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const candidates = [
    value.match(/\b(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})\b/),
    value.match(/\b(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})\b/),
  ];

  for (const match of candidates) {
    if (!match) continue;
    const parts = match.slice(1).map((part) => Number.parseInt(part, 10));
    const [first, second, third] = parts;
    const year = first > 31 ? first : third;
    const month = first > 31 ? second : first;
    const day = first > 31 ? third : second;
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return undefined;
}

async function stableManualExternalId(
  sourceApp: string,
  values: {
    sourceUrl?: string;
    rawTranscript: string;
    title?: string;
    recordedAt?: string;
  },
): Promise<string> {
  const hashInput = [
    sourceApp,
    values.sourceUrl ?? "",
    values.title ?? "",
    values.recordedAt ?? "",
    values.rawTranscript,
  ].join("\n");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(hashInput),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `manual-${sourceApp}-${hash.slice(0, 32)}`;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
