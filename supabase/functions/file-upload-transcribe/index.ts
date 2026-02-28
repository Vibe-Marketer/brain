import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkDuplicate, insertRecording } from '../_shared/connector-pipeline.ts';

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

    // Stage 3: Dedup
    const externalId = `${file.name}-${file.size}`;
    const { isDuplicate, existingRecordingId } = await checkDuplicate(supabase, user.id, 'file-upload', externalId);
    if (isDuplicate) {
      return new Response(
        JSON.stringify({ error: 'File already imported', exists: true, recordingId: existingRecordingId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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
      console.error('[file-upload-transcribe] Whisper error:', whisperRes.status, await whisperRes.text());
      return new Response(
        JSON.stringify({ error: `Transcription failed (Whisper ${whisperRes.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const transcript = await whisperRes.text();

    // Stage 5: Insert via shared pipeline
    const recording = await insertRecording(supabase, user.id, {
      external_id: externalId,
      source_app: 'file-upload',
      title: file.name.replace(/\.[^.]+$/, ''),
      full_transcript: transcript,
      recording_start_time: new Date().toISOString(),
      source_metadata: { original_filename: file.name, file_size: file.size, mime_type: file.type },
    });

    return new Response(
      JSON.stringify({ success: true, recordingId: recording.id }),
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
