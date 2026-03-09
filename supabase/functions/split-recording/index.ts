/**
 * SPLIT-RECORDING EDGE FUNCTION
 *
 * Splits a call recording into two separate recordings at a chosen transcript
 * segment boundary. Part 1 keeps segments before the split; Part 2 gets the
 * rest (including the segment the user right-clicked).
 *
 * Endpoint:
 *   POST /functions/v1/split-recording
 *   Body: { recording_id: number | string, segment_index: number }
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
  segment_index: z.number().int().min(0),
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

    const { recording_id, segment_index } = validation.data as SplitRequest;
    const isLegacyId = typeof recording_id === 'number';

    // -------------------------------------------------------------------------
    // 1. Fetch the source recording
    // -------------------------------------------------------------------------
    let sourceTitle = '';
    let fullTranscript = '';
    let organizationId: string | null = null;
    let audioUrl: string | null = null;
    let videoUrl: string | null = null;
    let duration: number | null = null;
    let recordingStartTime: string | null = null;
    let recordingEndTime: string | null = null;
    let sourceApp: string | null = null;
    let sourceMetadata: Record<string, unknown> = {};
    let calendarInvitees: unknown = null;
    let recordedByName: string | null = null;
    let recordedByEmail: string | null = null;
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
      calendarInvitees = call.calendar_invitees || null;
      recordedByName = call.recorded_by_name || null;
      recordedByEmail = call.recorded_by_email || null;
      recordingStartTime = call.recording_start_time || null;
      recordingEndTime = call.recording_end_time || null;
      duration = null; // Will recalculate from segments

      // Also try to fetch from recordings table for richer data + org/workspace linkage
      const { data: recRow } = await supabase
        .from('recordings')
        .select('id, organization_id, audio_url, video_url, source_app, source_metadata, duration')
        .eq('legacy_recording_id', recording_id)
        .maybeSingle();

      if (recRow) {
        recordingsUuid = recRow.id;
        organizationId = recRow.organization_id;
        audioUrl = recRow.audio_url || null;
        videoUrl = recRow.video_url || null;
        sourceApp = recRow.source_app || 'fathom';
        sourceMetadata = (recRow.source_metadata as Record<string, unknown>) || {};
        duration = recRow.duration || null;
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

      // Ownership check via org membership (RLS handles this via service role only in a limited way)
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
      duration = recRow.duration || null;
      recordingStartTime = recRow.recording_start_time || null;
      recordingEndTime = recRow.recording_end_time || null;
    }

    // -------------------------------------------------------------------------
    // 2. Parse and split transcript at segment_index
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

    if (segment_index <= 0 || segment_index >= allSegments.length) {
      return new Response(
        JSON.stringify({
          error: `segment_index must be between 1 and ${allSegments.length - 1} (got ${segment_index})`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const part1Segments = allSegments.slice(0, segment_index);
    const part2Segments = allSegments.slice(segment_index);

    const part1Transcript = buildTranscriptText(part1Segments);
    const part2Transcript = buildTranscriptText(part2Segments);

    // Derive per-part speakers from segments (unique speaker names in each half)
    const getSpeakers = (segs: typeof allSegments) =>
      Array.from(new Set(segs.map((s) => s.speaker)));

    const _part1Speakers = getSpeakers(part1Segments);
    const _part2Speakers = getSpeakers(part2Segments);

    // Naming
    const part1Title = `${sourceTitle} (Part 1)`;
    const part2Title = `${sourceTitle} (Part 2)`;

    // -------------------------------------------------------------------------
    // 3. Update Part 1 — rename in recordings table (and fathom_calls if legacy)
    // -------------------------------------------------------------------------
    if (recordingsUuid) {
      const { error: updateErr } = await supabase
        .from('recordings')
        .update({
          title: part1Title,
          full_transcript: part1Transcript,
          summary: null, // Reset — user should regenerate
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordingsUuid);

      if (updateErr) {
        throw new Error(`Failed to update Part 1 recording: ${updateErr.message}`);
      }
    }

    if (isLegacyId) {
      await supabase
        .from('fathom_calls')
        .update({
          title: part1Title,
          full_transcript: part1Transcript,
          summary: null,
        })
        .eq('recording_id', recording_id)
        .eq('user_id', user.id);
    }

    // -------------------------------------------------------------------------
    // 4. Create Part 2 recording in recordings table
    // -------------------------------------------------------------------------

    // Need organization_id for Part 2 — required by recordings table
    if (!organizationId) {
      // Try to find any organization the user belongs to as owner
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

    const { data: part2Row, error: part2Err } = await supabase
      .from('recordings')
      .insert({
        organization_id: organizationId,
        owner_user_id: user.id,
        title: part2Title,
        full_transcript: part2Transcript,
        audio_url: audioUrl,
        video_url: videoUrl,
        source_app: sourceApp,
        source_metadata: {
          ...sourceMetadata,
          split_from: isLegacyId ? recording_id : recordingsUuid,
          split_segment_index: segment_index,
          split_at: new Date().toISOString(),
        },
        duration: duration,
        recording_start_time: recordingStartTime,
        recording_end_time: recordingEndTime,
        created_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (part2Err || !part2Row) {
      throw new Error(`Failed to create Part 2 recording: ${part2Err?.message || 'unknown'}`);
    }

    const part2RecordingId = part2Row.id as string;

    // -------------------------------------------------------------------------
    // 5. Copy workspace_entries for Part 2 (same workspaces as Part 1)
    // -------------------------------------------------------------------------
    if (recordingsUuid) {
      const { data: existingEntries } = await supabase
        .from('workspace_entries')
        .select('workspace_id')
        .eq('recording_id', recordingsUuid);

      if (existingEntries && existingEntries.length > 0) {
        const newEntries = existingEntries.map((e: { workspace_id: string }) => ({
          workspace_id: e.workspace_id,
          recording_id: part2RecordingId,
          created_at: new Date().toISOString(),
        }));

        const { error: entryErr } = await supabase
          .from('workspace_entries')
          .insert(newEntries);

        if (entryErr) {
          console.error('Failed to copy workspace_entries for Part 2:', entryErr);
          // Non-fatal: Part 2 was created, just missing workspace linkage
        }
      } else {
        // No existing workspace entries found — add to home workspace
        const { data: homeWs } = await supabase
          .from('workspaces')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_home', true)
          .maybeSingle();

        if (homeWs) {
          await supabase
            .from('workspace_entries')
            .insert({
              workspace_id: homeWs.id,
              recording_id: part2RecordingId,
              created_at: new Date().toISOString(),
            });
        }
      }
    } else {
      // No recordings UUID — add Part 2 to home workspace
      const { data: homeWs } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_home', true)
        .maybeSingle();

      if (homeWs) {
        await supabase
          .from('workspace_entries')
          .insert({
            workspace_id: homeWs.id,
            recording_id: part2RecordingId,
            created_at: new Date().toISOString(),
          });
      }
    }

    // -------------------------------------------------------------------------
    // 6. Return result
    // -------------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        part1_recording_id: recordingsUuid || recording_id,
        part2_recording_id: part2RecordingId,
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
