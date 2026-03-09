/**
 * SPLIT-RECORDING EDGE FUNCTION
 *
 * Splits a call recording into two separate recordings at a chosen transcript
 * segment boundary. Part 1 keeps segments before the split; Part 2 gets the
 * rest (including the segment the user right-clicked).
 *
 * The critical DB writes (Part 1 update + Part 2 insert) are performed inside
 * the `split_recording_atomic` Postgres RPC, ensuring they are atomic.
 *
 * Endpoint:
 *   POST /functions/v1/split-recording
 *   Body: {
 *     recording_id: number | string,
 *     split_timestamp: string,   // "HH:MM:SS" — timestamp of the split segment
 *     split_speaker: string,     // speaker name of the split segment
 *   }
 *   Returns: { success, part1_recording_id, part2_recording_id, part1_title, part2_title }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';

const RequestSchema = z.object({
  recording_id: z.union([
    z.number().int().positive(),
    z.string().uuid(),
  ]),
  /** Timestamp of the segment to split at, in "HH:MM:SS" format. */
  split_timestamp: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'split_timestamp must be HH:MM:SS'),
  /** Speaker name of the segment to split at (for disambiguation). */
  split_speaker: z.string().min(1),
});

type SplitRequest = z.infer<typeof RequestSchema>;

// Parse full_transcript TEXT into segment array (mirrors frontend regex).
// Format: [HH:MM:SS] Speaker Name: segment text
function parseTranscriptSegments(full_transcript: string): Array<{
  timestamp: string;
  speaker: string;
  text: string;
}> {
  const segmentRegex = /\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+([^\n]+)/g;
  const segments: Array<{ timestamp: string; speaker: string; text: string }> = [];
  let match;

  while ((match = segmentRegex.exec(full_transcript)) !== null) {
    segments.push({
      timestamp: match[1],
      speaker: match[2].trim(),
      text: match[3].trim(),
    });
  }

  return segments;
}

// Rebuild a formatted transcript TEXT from a segment array.
function buildTranscriptText(
  segments: Array<{ timestamp: string; speaker: string; text: string }>
): string {
  return segments
    .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
    .join('\n');
}

// Parse "HH:MM:SS" timestamp into total seconds for duration math.
function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0]?.message || 'Invalid input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recording_id, split_timestamp, split_speaker } = validation.data as SplitRequest;
    const isLegacyId = typeof recording_id === 'number';

    // -------------------------------------------------------------------------
    // 1. Fetch the source recording
    // -------------------------------------------------------------------------
    let sourceTitle = '';
    let fullTranscript = '';
    let organizationId: string | null = null;
    let audioUrl: string | null = null;
    let videoUrl: string | null = null;
    let recordingStartTime: string | null = null;
    let recordingEndTime: string | null = null;
    let sourceApp: string | null = null;
    let sourceMetadata: Record<string, unknown> = {};
    let recordingsUuid: string | null = null;

    if (isLegacyId) {
      // Fetch from fathom_calls (legacy BIGINT id)
      const { data: call, error: callError } = await supabase
        .from('fathom_calls')
        .select('*')
        .eq('recording_id', recording_id)
        .eq('user_id', user.id)
        .single();

      if (callError || !call) {
        return new Response(
          JSON.stringify({ error: 'Recording not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sourceTitle = call.title || 'Untitled';
      fullTranscript = call.full_transcript || '';
      recordingStartTime = call.recording_start_time || null;
      recordingEndTime = call.recording_end_time || null;

      // Enrich with recordings table row if it exists
      const { data: recRow } = await supabase
        .from('recordings')
        .select('id, organization_id, audio_url, video_url, source_app, source_metadata')
        .eq('legacy_recording_id', recording_id)
        .maybeSingle();

      if (recRow) {
        recordingsUuid = recRow.id;
        organizationId = recRow.organization_id;
        audioUrl = recRow.audio_url || null;
        videoUrl = recRow.video_url || null;
        sourceApp = recRow.source_app || 'fathom';
        sourceMetadata = (recRow.source_metadata as Record<string, unknown>) || {};
      }
    } else {
      // UUID-based recording
      const { data: recRow, error: recError } = await supabase
        .from('recordings')
        .select('*')
        .eq('id', recording_id)
        .single();

      if (recError || !recRow) {
        return new Response(
          JSON.stringify({ error: 'Recording not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (recRow.owner_user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Recording not found or unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      recordingsUuid = recRow.id;
      sourceTitle = recRow.title || 'Untitled';
      fullTranscript = recRow.full_transcript || '';
      organizationId = recRow.organization_id;
      audioUrl = recRow.audio_url || null;
      videoUrl = recRow.video_url || null;
      sourceApp = recRow.source_app || null;
      sourceMetadata = (recRow.source_metadata as Record<string, unknown>) || {};
      recordingStartTime = recRow.recording_start_time || null;
      recordingEndTime = recRow.recording_end_time || null;
    }

    // -------------------------------------------------------------------------
    // 2. Parse transcript and find split point by timestamp + speaker
    // -------------------------------------------------------------------------
    if (!fullTranscript.trim()) {
      return new Response(
        JSON.stringify({ error: 'No transcript available to split' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allSegments = parseTranscriptSegments(fullTranscript);

    if (allSegments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not parse any transcript segments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find split point using timestamp + speaker as a unique locator.
    // This avoids the index-mismatch bug that occurs when the frontend uses
    // a filtered (deleted-excluded) transcript array but the backend parses
    // the raw full_transcript which still contains all original segments.
    const splitIndex = allSegments.findIndex(
      (s) => s.timestamp === split_timestamp && s.speaker === split_speaker
    );

    // Timestamp-only fallback index (computed once, reused below to avoid double scan)
    const timestampOnlyIndex = splitIndex < 0
      ? allSegments.findIndex((s) => s.timestamp === split_timestamp)
      : -1; // not needed when primary match succeeded

    if (splitIndex <= 0) {
      if (splitIndex === 0) {
        return new Response(
          JSON.stringify({ error: 'Cannot split at the first segment — choose a later segment' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Primary match failed — fall back to timestamp-only.
      // The frontend sends the original speaker_name (not the edited display name),
      // so this fallback is a safety net for edge cases rather than the common path.
      if (timestampOnlyIndex <= 0) {
        return new Response(
          JSON.stringify({
            error: `Split point not found in transcript (timestamp: ${split_timestamp}, speaker: ${split_speaker})`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const resolvedSplitIndex = splitIndex >= 0 ? splitIndex : timestampOnlyIndex;

    const part1Segments = allSegments.slice(0, resolvedSplitIndex);
    const part2Segments = allSegments.slice(resolvedSplitIndex);

    const part1Transcript = buildTranscriptText(part1Segments);
    const part2Transcript = buildTranscriptText(part2Segments);

    // -------------------------------------------------------------------------
    // 3. Compute per-part timing metadata from segment timestamps
    // -------------------------------------------------------------------------
    // Part 1 keeps the original start time; end time approximated from last segment.
    // Part 2 start time approximated from its first segment; duration from range.
    const part1LastTimestamp = part1Segments.at(-1)?.timestamp;
    const part2FirstTimestamp = part2Segments[0]?.timestamp;
    const part2LastTimestamp = part2Segments.at(-1)?.timestamp;

    let part2StartTime: string | null = null;
    let part2Duration: number | null = null;

    if (recordingStartTime && part2FirstTimestamp) {
      // Offset part2 start from the original call's start time
      const offsetSeconds = timestampToSeconds(part2FirstTimestamp);
      const base = new Date(recordingStartTime);
      base.setSeconds(base.getSeconds() + offsetSeconds);
      part2StartTime = base.toISOString();
    }

    if (part2FirstTimestamp && part2LastTimestamp) {
      part2Duration = timestampToSeconds(part2LastTimestamp) - timestampToSeconds(part2FirstTimestamp);
    }

    // Part 1 duration: from recording start to last segment timestamp
    let part1Duration: number | null = null;
    if (part1LastTimestamp) {
      part1Duration = timestampToSeconds(part1LastTimestamp);
    }

    // Naming
    const part1Title = `${sourceTitle} (Part 1)`;
    const part2Title = `${sourceTitle} (Part 2)`;

    // -------------------------------------------------------------------------
    // 4. Resolve organization_id (needed for the RPC + workspace lookup)
    // -------------------------------------------------------------------------
    if (!organizationId) {
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      organizationId = orgMember?.organization_id || null;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Cannot create Part 2: no organization found for user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Atomic DB writes via RPC (Part 1 update + Part 2 insert in one tx)
    // -------------------------------------------------------------------------
    const { data: part2RecordingId, error: rpcError } = await supabase.rpc(
      'split_recording_atomic',
      {
        p_part1_recordings_id:  recordingsUuid ?? null,
        p_part1_fathom_id:      isLegacyId ? recording_id : null,
        p_part1_title:          part1Title,
        p_part1_transcript:     part1Transcript,
        p_part2_title:          part2Title,
        p_part2_transcript:     part2Transcript,
        p_organization_id:      organizationId,
        p_owner_user_id:        user.id,
        p_source_app:           sourceApp,
        p_source_metadata:      {
          ...sourceMetadata,
          split_from: isLegacyId ? recording_id : recordingsUuid,
          split_at: new Date().toISOString(),
          split_timestamp,
        },
        p_recording_start_time: part2StartTime,
        p_recording_end_time:   null, // Not reliably known from segments
        p_audio_url:            audioUrl,
        p_video_url:            videoUrl,
      }
    );

    if (rpcError) {
      throw new Error(`Atomic split failed: ${rpcError.message}`);
    }

    const part2Id = part2RecordingId as string;

    // Also update Part 1 duration in recordings table if we computed one
    if (recordingsUuid && part1Duration !== null) {
      await supabase
        .from('recordings')
        .update({ duration: part1Duration })
        .eq('id', recordingsUuid);
    }

    // Update Part 2 duration
    if (part2Duration !== null) {
      await supabase
        .from('recordings')
        .update({ duration: part2Duration })
        .eq('id', part2Id);
    }

    // -------------------------------------------------------------------------
    // 6. Copy workspace_entries for Part 2 (non-critical — runs after atomic writes)
    // -------------------------------------------------------------------------
    if (recordingsUuid) {
      const { data: existingEntries } = await supabase
        .from('workspace_entries')
        .select('workspace_id')
        .eq('recording_id', recordingsUuid);

      if (existingEntries && existingEntries.length > 0) {
        const newEntries = existingEntries.map((e: { workspace_id: string }) => ({
          workspace_id: e.workspace_id,
          recording_id: part2Id,
          created_at: new Date().toISOString(),
        }));

        const { error: entryErr } = await supabase
          .from('workspace_entries')
          .insert(newEntries);

        if (entryErr) {
          // Non-fatal — Part 2 recording exists, workspace linkage can be repaired
          console.error('Failed to copy workspace_entries for Part 2:', entryErr.message);
        }
      } else {
        // No workspace entries found — add Part 2 to the home workspace
        const { data: homeWs } = await supabase
          .from('workspaces')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_home', true)
          .maybeSingle();

        if (homeWs) {
          await supabase
            .from('workspace_entries')
            .insert({ workspace_id: homeWs.id, recording_id: part2Id });
        }
      }
    } else {
      // Legacy recording without a recordings row — add Part 2 to home workspace
      const { data: homeWs } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_home', true)
        .maybeSingle();

      if (homeWs) {
        await supabase
          .from('workspace_entries')
          .insert({ workspace_id: homeWs.id, recording_id: part2Id });
      }
    }

    // -------------------------------------------------------------------------
    // 7. Return result
    // -------------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        part1_recording_id: recordingsUuid || recording_id,
        part2_recording_id: part2Id,
        part1_title: part1Title,
        part2_title: part2Title,
        part1_segment_count: part1Segments.length,
        part2_segment_count: part2Segments.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('split-recording error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
