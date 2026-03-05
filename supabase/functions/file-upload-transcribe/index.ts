import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { runPipeline } from '../_shared/connector-pipeline.ts';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — Whisper API limit
const ACCEPTED_TYPES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/x-m4a',
  'video/mp4', 'video/quicktime', 'video/webm',
]);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided. Send a file in the "file" form field.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate: size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File exceeds 25MB limit. For video files, consider extracting the audio track first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate: type
    if (!ACCEPTED_TYPES.has(file.type)) {
      return new Response(
        JSON.stringify({ error: `Unsupported file type "${file.type}". Accepted formats: MP3, WAV, MP4, M4A, MOV, WebM.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Monthly quota check (10 imports/month free tier)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { count } = await supabase
      .from('recordings')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .gte('created_at', monthStart);
    if ((count ?? 0) >= 10) {
      return new Response(
        JSON.stringify({ error: 'Monthly import limit reached (10/month on free tier). Upgrade for unlimited imports.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build external ID for dedup
    const externalId = `${file.name}-${file.size}`;

    // Stage 4: Whisper transcription
    const whisperForm = new FormData();
    whisperForm.append('file', file);
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('response_format', 'text');

    const whisperRes = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errorText = await whisperRes.text();
      console.error('[file-upload-transcribe] Whisper error:', whisperRes.status, errorText);
      return new Response(
        JSON.stringify({ error: `Transcription failed: ${errorText} (Whisper ${whisperRes.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const transcriptText = await whisperRes.text();

    // Stage 5 — Run through pipeline (Dedup -> Routing -> Insert)
    const result = await runPipeline(supabase, user.id, {
      external_id: externalId,
      source_app: 'file-upload',
      title: file.name.replace(/\.[^.]+$/, ''),
      full_transcript: transcriptText,
      recording_start_time: new Date().toISOString(),
      source_metadata: { 
        original_filename: file.name, 
        file_size: file.size, 
        mime_type: file.type,
        import_source: 'file-upload-transcribe',
        synced_at: new Date().toISOString(),
      },
    });

    if (!result.success) {
      if (result.skipped) {
        return new Response(
          JSON.stringify({ error: 'File already imported', exists: true, recordingId: result.recordingId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(result.error || 'Pipeline failed');
    }

    // Write to upload_raw_files for source-specific detail
    try {
      const { error: rawError } = await supabase
        .from('upload_raw_files')
        .insert({
          recording_id: result.recordingId,
          user_id: user.id,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          full_transcript: transcriptText,
          raw_payload: {
            import_source: 'file-upload-transcribe',
            synced_at: new Date().toISOString(),
          },
        });

      if (rawError) {
        console.error(`[file-upload-transcribe] Error inserting upload_raw_files (non-blocking):`, rawError);
      }
    } catch (rawErr) {
      console.error(`[file-upload-transcribe] Error writing upload_raw_files (non-blocking):`, rawErr);
    }

    return new Response(
      JSON.stringify({ success: true, recordingId: result.recordingId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[file-upload-transcribe] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
