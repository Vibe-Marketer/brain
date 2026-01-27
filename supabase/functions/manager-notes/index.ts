import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// Dynamic CORS headers - set per-request from origin
let corsHeaders: Record<string, string> = {};

/**
 * Manager Notes Edge Function
 *
 * Handles private manager notes on direct reports' calls:
 * - POST /manager-notes - Create or update a manager note
 * - GET /manager-notes - Get notes for a specific call or all notes
 * - DELETE /manager-notes?id=xxx - Delete a note
 *
 * Notes are private to the manager who created them - other managers
 * and the direct report cannot see each other's notes.
 */

interface CreateNoteInput {
  user_id: string; // The manager making the request
  call_recording_id: number;
  report_user_id: string; // The call owner (direct report)
  note: string;
}

interface UpdateNoteInput {
  user_id: string;
  note_id: string;
  note: string;
}

interface DeleteNoteInput {
  user_id: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);

    // Route by HTTP method
    switch (req.method) {
      case 'POST':
        return handleCreateOrUpdateNote(req, supabaseClient);
      case 'GET':
        return handleGetNotes(url, supabaseClient);
      case 'DELETE':
        return handleDeleteNote(req, supabaseClient, url);
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * POST /manager-notes
 * Create a new note or update an existing one
 *
 * If note_id is provided, updates the existing note
 * Otherwise, creates a new note (or upserts based on manager + call)
 */
async function handleCreateOrUpdateNote(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const body = await req.json();

  // Check if this is an update request
  if (body.note_id) {
    return handleUpdateNote(body as UpdateNoteInput, supabaseClient);
  }

  // Otherwise, create a new note
  return handleCreateNote(body as CreateNoteInput, supabaseClient);
}

/**
 * Create a new manager note
 */
async function handleCreateNote(
  input: CreateNoteInput,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const { user_id, call_recording_id, report_user_id, note } = input;

  // Validate required fields
  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!call_recording_id) {
    return new Response(
      JSON.stringify({ error: 'call_recording_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!report_user_id) {
    return new Response(
      JSON.stringify({ error: 'report_user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!note || note.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'note is required and cannot be empty' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the manager has a valid manager relationship with the report
  const { data: isManagerResult, error: managerError } = await supabaseClient
    .rpc('is_manager_of', {
      p_manager_user_id: user_id,
      p_report_user_id: report_user_id,
    });

  if (managerError) {
    return new Response(
      JSON.stringify({ error: 'Error checking manager relationship', details: managerError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!isManagerResult) {
    return new Response(
      JSON.stringify({ error: 'You are not a manager of this user' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the call exists and belongs to the report
  const { data: call, error: callError } = await supabaseClient
    .from('fathom_calls')
    .select('recording_id, user_id')
    .eq('recording_id', call_recording_id)
    .eq('user_id', report_user_id)
    .maybeSingle();

  if (callError || !call) {
    return new Response(
      JSON.stringify({ error: 'Call not found or does not belong to the direct report' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if a note already exists for this manager + call combination
  const { data: existingNote } = await supabaseClient
    .from('manager_notes')
    .select('id')
    .eq('manager_user_id', user_id)
    .eq('call_recording_id', call_recording_id)
    .eq('user_id', report_user_id)
    .maybeSingle();

  if (existingNote) {
    // Update existing note instead of creating duplicate
    const { data: updatedNote, error: updateError } = await supabaseClient
      .from('manager_notes')
      .update({
        note: note.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingNote.id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Error updating note', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        note: updatedNote,
        message: 'Note updated successfully',
        action: 'updated',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create the note
  const { data: newNote, error: insertError } = await supabaseClient
    .from('manager_notes')
    .insert({
      manager_user_id: user_id,
      call_recording_id,
      user_id: report_user_id,
      note: note.trim(),
    })
    .select()
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: 'Error creating note', details: insertError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      note: newNote,
      message: 'Note created successfully',
      action: 'created',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Update an existing manager note
 */
async function handleUpdateNote(
  input: UpdateNoteInput,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const { user_id, note_id, note } = input;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!note_id) {
    return new Response(
      JSON.stringify({ error: 'note_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!note || note.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'note is required and cannot be empty' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch the note and verify ownership
  const { data: existingNote, error: fetchError } = await supabaseClient
    .from('manager_notes')
    .select('id, manager_user_id')
    .eq('id', note_id)
    .single();

  if (fetchError || !existingNote) {
    return new Response(
      JSON.stringify({ error: 'Note not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is the manager who owns this note
  if (existingNote.manager_user_id !== user_id) {
    return new Response(
      JSON.stringify({ error: 'You can only update your own notes' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update the note
  const { data: updatedNote, error: updateError } = await supabaseClient
    .from('manager_notes')
    .update({
      note: note.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', note_id)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error updating note', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      note: updatedNote,
      message: 'Note updated successfully',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /manager-notes
 * Get notes for a specific call or all notes for the manager
 *
 * Query params:
 * - user_id: The manager requesting notes (required)
 * - call_recording_id: Get notes for a specific call
 * - report_user_id: The call owner (required with call_recording_id)
 */
async function handleGetNotes(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const callRecordingId = url.searchParams.get('call_recording_id');
  const reportUserId = url.searchParams.get('report_user_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build base query - notes where user is the manager
  let query = supabaseClient
    .from('manager_notes')
    .select(`
      id,
      manager_user_id,
      call_recording_id,
      user_id,
      note,
      created_at,
      updated_at
    `)
    .eq('manager_user_id', userId);

  // Filter by specific call if provided
  if (callRecordingId) {
    if (!reportUserId) {
      return new Response(
        JSON.stringify({ error: 'report_user_id is required when filtering by call_recording_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    query = query
      .eq('call_recording_id', parseInt(callRecordingId))
      .eq('user_id', reportUserId);
  }

  // Filter by report if provided (to get all notes for a specific direct report)
  if (reportUserId && !callRecordingId) {
    query = query.eq('user_id', reportUserId);
  }

  query = query.order('created_at', { ascending: false });

  const { data: notes, error: fetchError } = await query;

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching notes', details: fetchError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Enhance notes with report user info
  const enhancedNotes = await Promise.all(
    (notes || []).map(async (noteItem) => {
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('display_name, avatar_url')
        .eq('user_id', noteItem.user_id)
        .maybeSingle();

      return {
        ...noteItem,
        report_display_name: userSettings?.display_name || null,
        report_avatar_url: userSettings?.avatar_url || null,
      };
    })
  );

  return new Response(
    JSON.stringify({ notes: enhancedNotes }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /manager-notes?id=xxx
 * Delete a manager note
 */
async function handleDeleteNote(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const noteId = url.searchParams.get('id');

  // Get user_id from body
  let userId: string | null = null;
  try {
    const body = await req.json() as DeleteNoteInput;
    userId = body.user_id;
  } catch {
    // Body might be empty
  }

  if (!noteId) {
    return new Response(
      JSON.stringify({ error: 'Note id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch the note and verify ownership
  const { data: existingNote, error: fetchError } = await supabaseClient
    .from('manager_notes')
    .select('id, manager_user_id')
    .eq('id', noteId)
    .single();

  if (fetchError || !existingNote) {
    return new Response(
      JSON.stringify({ error: 'Note not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is the manager who owns this note (if user_id provided)
  if (userId && existingNote.manager_user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'You can only delete your own notes' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delete the note
  const { error: deleteError } = await supabaseClient
    .from('manager_notes')
    .delete()
    .eq('id', noteId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: 'Error deleting note', details: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ message: 'Note deleted successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
