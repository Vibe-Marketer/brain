import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  coerceFirefliesDate,
  fetchFirefliesTranscripts,
  normalizeDurationSeconds,
  type FirefliesTranscript,
} from "../_shared/fireflies-connector.ts";
import { getDecryptedFirefliesSourceForUser } from "../_shared/fireflies-credentials.ts";

interface FirefliesFetchMeetingsRequest {
  createdAfter?: string | null;
  createdBefore?: string | null;
  sourceId?: string | null;
  skip?: number;
  limit?: number;
}

interface FirefliesListRow {
  recording_id: string;
  title: string;
  created_at: string;
  recording_start_time: string | null;
  recording_end_time: string | null;
  duration: number | null;
  synced: boolean;
  calendar_invitees: Array<{ name: string | null; email: string | null }>;
  source_url: string | null;
  share_url: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = (await req.json()) as FirefliesFetchMeetingsRequest;
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 50);
    const skip = Math.max(body.skip ?? 0, 0);

    const source = await getDecryptedFirefliesSourceForUser(supabase, userId);
    if (!source?.api_key) {
      return new Response(
        JSON.stringify({
          error: "Fireflies is not connected. Save an API key first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Also pull the row's account_email for the response. Cheap second read —
    // splits keep the credential-decryption RPC focused on the secret fields.
    const { data: sourceMeta } = await (supabase as any)
      .from("import_sources")
      .select("account_email")
      .eq("id", source.id)
      .eq("user_id", userId)
      .maybeSingle();

    const transcripts = await fetchFirefliesTranscripts(source.api_key, {
      fromDate: body.createdAfter ?? null,
      toDate: body.createdBefore ?? null,
      limit,
      skip,
    });

    const ids = transcripts.map((item) => item.id).filter(Boolean);
    const syncedIds = new Set<string>();
    if (ids.length > 0) {
      const { data: recordings, error: recordingsError } = await supabase
        .from("recordings")
        .select("source_call_id")
        .eq("owner_user_id", userId)
        .eq("source_app", "fireflies")
        .in("source_call_id", ids);
      if (recordingsError) throw recordingsError;
      for (const row of recordings ?? []) {
        if (row.source_call_id) syncedIds.add(String(row.source_call_id));
      }
    }

    // Per-item try/catch — a single malformed transcript (e.g. missing
    // dateString and missing date) must not nuke the entire listing with a 500.
    // Drop the bad row and keep going; the user sees what Fireflies returned
    // minus the unmappable entry, and we log enough context to chase the
    // mapper bug.
    const meetings: FirefliesListRow[] = [];
    for (const transcript of transcripts) {
      try {
        meetings.push(mapTranscriptToListRow(transcript, syncedIds));
      } catch (mapError) {
        console.error(
          `Fireflies fetch-meetings: dropping malformed transcript ${transcript.id ?? "<no id>"}:`,
          mapError,
        );
      }
    }

    return new Response(
      JSON.stringify({
        meetings,
        nextSkip:
          transcripts.length === limit ? skip + transcripts.length : null,
        sourceId: source.id,
        accountEmail: sourceMeta?.account_email ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching Fireflies meetings:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function mapTranscriptToListRow(
  transcript: FirefliesTranscript,
  syncedIds: Set<string>,
): FirefliesListRow {
  const start = coerceFirefliesDate(transcript.dateString ?? transcript.date);
  const durationSeconds = normalizeDurationSeconds(
    transcript.duration,
    transcript.sentences ?? [],
  );
  const end =
    durationSeconds != null
      ? new Date(
          new Date(start).getTime() + durationSeconds * 1000,
        ).toISOString()
      : null;

  return {
    recording_id: transcript.id,
    title: transcript.title?.trim() || "Untitled Fireflies Call",
    created_at: start,
    recording_start_time: start,
    recording_end_time: end,
    duration: durationSeconds,
    synced: syncedIds.has(transcript.id),
    calendar_invitees: normalizeFirefliesInvitees(transcript.meeting_attendees ?? []),
    source_url: transcript.transcript_url ?? transcript.meeting_link ?? null,
    share_url: transcript.transcript_url ?? transcript.meeting_link ?? null,
  };
}

function normalizeFirefliesInvitees(
  attendees: NonNullable<FirefliesTranscript["meeting_attendees"]>,
): FirefliesListRow["calendar_invitees"] {
  return attendees.flatMap((attendee): FirefliesListRow["calendar_invitees"] => {
    const name = attendee.displayName ?? attendee.name ?? null;
    const rawEmail = attendee.email ?? "";
    const emails = rawEmail
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes("@"));

    if (emails.length === 0) return [{ name, email: null }];
    return emails.map((email) => ({ name: emails.length === 1 ? name : null, email }));
  });
}
