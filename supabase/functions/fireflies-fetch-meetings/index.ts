import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchFirefliesTranscripts, type FirefliesTranscript } from '../_shared/fireflies-connector.ts';

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
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json() as FirefliesFetchMeetingsRequest;
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 50);
    const skip = Math.max(body.skip ?? 0, 0);

    const { data: source, error: sourceError } = await supabase
      .from('import_sources')
      .select('id, api_key, webhook_signing_secret, account_email')
      .eq('user_id', userId)
      .eq('source_app', 'fireflies')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source?.api_key) {
      return new Response(JSON.stringify({ error: 'Fireflies is not connected. Save an API key first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        .from('recordings')
        .select('source_call_id')
        .eq('owner_user_id', userId)
        .eq('source_app', 'fireflies')
        .in('source_call_id', ids);
      if (recordingsError) throw recordingsError;
      for (const row of recordings ?? []) {
        if (row.source_call_id) syncedIds.add(String(row.source_call_id));
      }
    }

    const meetings: FirefliesListRow[] = transcripts.map((transcript) => mapTranscriptToListRow(transcript, syncedIds));

    return new Response(JSON.stringify({
      meetings,
      nextSkip: transcripts.length === limit ? skip + transcripts.length : null,
      sourceId: source.id,
      accountEmail: source.account_email,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching Fireflies meetings:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapTranscriptToListRow(transcript: FirefliesTranscript, syncedIds: Set<string>): FirefliesListRow {
  const start = coerceDate(transcript.dateString ?? transcript.date);
  const durationSeconds = normalizeDurationSeconds(transcript.duration);
  const end = durationSeconds != null ? new Date(new Date(start).getTime() + durationSeconds * 1000).toISOString() : null;

  return {
    recording_id: transcript.id,
    title: transcript.title?.trim() || 'Untitled Fireflies Call',
    created_at: start,
    recording_start_time: start,
    recording_end_time: end,
    duration: durationSeconds,
    synced: syncedIds.has(transcript.id),
    calendar_invitees: (transcript.meeting_attendees ?? []).map((attendee) => ({
      name: attendee.displayName ?? attendee.name ?? null,
      email: attendee.email ?? null,
    })),
    source_url: transcript.transcript_url ?? transcript.meeting_link ?? null,
    share_url: transcript.transcript_url ?? transcript.meeting_link ?? null,
  };
}

function normalizeDurationSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function coerceDate(value: number | string | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  throw new Error('Fireflies transcript is missing a valid date/dateString');
}
