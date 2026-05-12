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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { parseFathomCopyFormat, extractShareToken } from '../_shared/fathom-transcript-parser.ts';
import { authenticateRequest } from '../_shared/auth.ts';

const FATHOM_URL_RE = /^https?:\/\/(www\.)?fathom\.video\//;

const inputSchema = z.object({
  share_url: z.string().trim().max(2048).optional(),
  raw_transcript: z.string()
    .min(20, 'Transcript appears too short to be meaningful')
    .max(5_000_000, 'Transcript exceeds maximum size of 5MB'),
  title: z.string().trim().max(500).optional(),
  recorded_at: z.string().datetime({ offset: true }).optional(),
  attendees: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  organization_id: z.string().uuid('organization_id must be a UUID'),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // 2. Auth
        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // 3. Parse + validate input
    const rawBody = await req.json().catch(() => ({}));
    const validation = inputSchema.safeParse(rawBody);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage, details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const {
      share_url,
      raw_transcript,
      title: titleOverride,
      recorded_at: recordedAtOverride,
      attendees: attendeesOverride,
      organization_id,
    } = validation.data;

    // 4. T-24-08: validate share_url is a fathom.video URL if provided.
    //    Defense-in-depth: even though we never fetch it server-side, we DO render it
    //    as a `window.open` target on the recording detail page, so an open-redirect
    //    via storage would expose users to a click-to-malicious-site risk.
    if (share_url && !FATHOM_URL_RE.test(share_url)) {
      return new Response(
        JSON.stringify({ error: 'share_url must be a fathom.video URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. T-24-02: verify user is a member of the requested organization.
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('id, role')
      .eq('organization_id', organization_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      console.error('[save-pasted-transcript] Error checking org membership:', membershipError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify workspace access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of the requested workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Parse the transcript (D-08, D-09, D-10).
    const parsed = parseFathomCopyFormat(raw_transcript);
    const shareToken = share_url ? extractShareToken(share_url) : null;

    // 7. Build payload (D-02, D-04).
    const lastSeg = parsed.parse_status === 'parsed' && parsed.segments.length > 0
      ? parsed.segments[parsed.segments.length - 1]
      : null;
    const duration = lastSeg ? Math.ceil(lastSeg.start_ms / 1000) : null;

    // Render full_transcript in the bracketed `[HH:MM:SS] Speaker: text` format
    // that the existing CallTranscriptTab regex parser expects
    // (src/hooks/useCallDetailQueries.ts:127). For raw/unparsed pastes we keep
    // the original text — FTS still indexes the words, but the conversation
    // view will show "No conversation available" (acceptable degradation).
    const formatTimestamp = (ms: number): string => {
      const totalSec = Math.floor(ms / 1000);
      const hh = Math.floor(totalSec / 3600).toString().padStart(2, '0');
      const mm = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
      const ss = (totalSec % 60).toString().padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    };
    const renderedTranscript = parsed.parse_status === 'parsed' && parsed.segments.length > 0
      ? parsed.segments
          .map(seg => `[${formatTimestamp(seg.start_ms)}] ${seg.speaker}: ${seg.text}`)
          .join('\n')
      : raw_transcript;

    const sourceMetadata = {
      external_id: shareToken,  // matches connector-pipeline convention
      share_url: share_url ?? null,
      parse_status: parsed.parse_status,
      attendees: attendeesOverride ?? parsed.attendees,
      paste_source: 'fathom-share-link',
      pasted_at: new Date().toISOString(),
      recorded_by_name: null,
      recorded_by_email: null,
    };

    const payload = {
      organization_id,
      owner_user_id: userId,
      title: titleOverride ?? parsed.title ?? 'Untitled pasted transcript',
      full_transcript: renderedTranscript,
      summary: null,
      source_app: 'fathom-paste',
      source_call_id: shareToken,  // also populates the existing global dedup constraint
      source_metadata: sourceMetadata,
      transcript_segments: parsed.parse_status === 'parsed' ? parsed.segments : null,
      share_token: shareToken,
      recording_start_time: recordedAtOverride ?? parsed.recorded_at ?? null,
      duration,
      global_tags: [] as string[],
    };

    // 8. Upsert (D-03). Explicit select-then-insert/update for deterministic action label.
    let recordingId: string;
    let action: 'created' | 'updated';

    if (shareToken) {
      // Look for an existing paste in this org with the same token.
      const { data: existing, error: lookupError } = await supabase
        .from('recordings')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('share_token', shareToken)
        .maybeSingle();

      if (lookupError) {
        console.error('[save-pasted-transcript] Existing-row lookup failed:', lookupError);
        return new Response(
          JSON.stringify({ error: 'Failed to check for existing transcript' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('recordings')
          .update({
            title: payload.title,
            full_transcript: payload.full_transcript,
            source_metadata: payload.source_metadata,
            transcript_segments: payload.transcript_segments,
            recording_start_time: payload.recording_start_time,
            duration: payload.duration,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updateError) {
          console.error('[save-pasted-transcript] Update failed:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update transcript' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        recordingId = existing.id;
        action = 'updated';
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('recordings')
          .insert(payload)
          .select('id')
          .single();
        if (insertError || !inserted) {
          console.error('[save-pasted-transcript] Insert failed:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save transcript' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        recordingId = inserted.id;
        action = 'created';
      }
    } else {
      // No share_url / no token → no dedup, plain insert.
      const { data: inserted, error: insertError } = await supabase
        .from('recordings')
        .insert(payload)
        .select('id')
        .single();
      if (insertError || !inserted) {
        console.error('[save-pasted-transcript] Insert failed:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save transcript' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      recordingId = inserted.id;
      action = 'created';
    }

    return new Response(
      JSON.stringify({ success: true, data: { recording_id: recordingId, action } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    // T-24-04: never echo back JWT, service key, or full request body.
    console.error('[save-pasted-transcript] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
