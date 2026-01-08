import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Coach Notes Edge Function
 *
 * Handles private coach notes on coachee calls:
 * - POST /coach-notes - Create or update a coach note
 * - GET /coach-notes - Get notes for a specific call
 * - DELETE /coach-notes?id=xxx - Delete a note
 *
 * Notes are private to the coach who created them - other coaches
 * viewing the same coachee's call cannot see each other's notes.
 */

interface CreateNoteInput {
  user_id: string; // The coach making the request
  relationship_id: string;
  call_recording_id: number;
  coachee_user_id: string; // The call owner (for composite FK)
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
 * POST /coach-notes
 * Create a new note or update an existing one
 *
 * If note_id is provided, updates the existing note
 * Otherwise, creates a new note (or upserts based on relationship + call)
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
 * Create a new coach note
 */
async function handleCreateNote(
  input: CreateNoteInput,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const { user_id, relationship_id, call_recording_id, coachee_user_id, note } = input;

  // Validate required fields
  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!relationship_id) {
    return new Response(
      JSON.stringify({ error: 'relationship_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!call_recording_id) {
    return new Response(
      JSON.stringify({ error: 'call_recording_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!coachee_user_id) {
    return new Response(
      JSON.stringify({ error: 'coachee_user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!note || note.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'note is required and cannot be empty' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify relationship exists and user is the coach
  const { data: relationship, error: relError } = await supabaseClient
    .from('coach_relationships')
    .select('id, coach_user_id, coachee_user_id, status')
    .eq('id', relationship_id)
    .single();

  if (relError || !relationship) {
    return new Response(
      JSON.stringify({ error: 'Relationship not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only the coach in the relationship can create notes
  if (relationship.coach_user_id !== user_id) {
    return new Response(
      JSON.stringify({ error: 'Only the coach can create notes on this relationship' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify coachee_user_id matches the relationship
  if (relationship.coachee_user_id !== coachee_user_id) {
    return new Response(
      JSON.stringify({ error: 'coachee_user_id does not match the relationship' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Relationship must be active
  if (relationship.status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Relationship must be active to create notes' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the call exists and belongs to the coachee
  const { data: call, error: callError } = await supabaseClient
    .from('fathom_calls')
    .select('recording_id, user_id')
    .eq('recording_id', call_recording_id)
    .eq('user_id', coachee_user_id)
    .maybeSingle();

  if (callError || !call) {
    return new Response(
      JSON.stringify({ error: 'Call not found or does not belong to the coachee' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if a note already exists for this relationship + call combination
  const { data: existingNote } = await supabaseClient
    .from('coach_notes')
    .select('id')
    .eq('relationship_id', relationship_id)
    .eq('call_recording_id', call_recording_id)
    .eq('user_id', coachee_user_id)
    .maybeSingle();

  if (existingNote) {
    // Update existing note instead of creating duplicate
    const { data: updatedNote, error: updateError } = await supabaseClient
      .from('coach_notes')
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
    .from('coach_notes')
    .insert({
      relationship_id,
      call_recording_id,
      user_id: coachee_user_id,
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
 * Update an existing coach note
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

  // Fetch the note and verify ownership via relationship
  const { data: existingNote, error: fetchError } = await supabaseClient
    .from('coach_notes')
    .select(`
      id,
      relationship_id,
      coach_relationships (coach_user_id)
    `)
    .eq('id', note_id)
    .single();

  if (fetchError || !existingNote) {
    return new Response(
      JSON.stringify({ error: 'Note not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is the coach who owns this note
  const coachUserId = (existingNote.coach_relationships as { coach_user_id: string })?.coach_user_id;
  if (coachUserId !== user_id) {
    return new Response(
      JSON.stringify({ error: 'You can only update your own notes' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update the note
  const { data: updatedNote, error: updateError } = await supabaseClient
    .from('coach_notes')
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
 * GET /coach-notes
 * Get notes for a specific call or relationship
 *
 * Query params:
 * - user_id: The coach requesting notes (required)
 * - call_recording_id: Get notes for a specific call
 * - coachee_user_id: The call owner (required with call_recording_id)
 * - relationship_id: Get all notes for a relationship (optional filter)
 */
async function handleGetNotes(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const callRecordingId = url.searchParams.get('call_recording_id');
  const coacheeUserId = url.searchParams.get('coachee_user_id');
  const relationshipId = url.searchParams.get('relationship_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build base query - notes where user is the coach in the relationship
  let query = supabaseClient
    .from('coach_notes')
    .select(`
      id,
      relationship_id,
      call_recording_id,
      user_id,
      note,
      created_at,
      updated_at,
      coach_relationships!inner (
        id,
        coach_user_id,
        coachee_user_id,
        status
      )
    `)
    .eq('coach_relationships.coach_user_id', userId);

  // Filter by specific call if provided
  if (callRecordingId) {
    if (!coacheeUserId) {
      return new Response(
        JSON.stringify({ error: 'coachee_user_id is required when filtering by call_recording_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    query = query
      .eq('call_recording_id', parseInt(callRecordingId))
      .eq('user_id', coacheeUserId);
  }

  // Filter by relationship if provided
  if (relationshipId) {
    query = query.eq('relationship_id', relationshipId);
  }

  query = query.order('created_at', { ascending: false });

  const { data: notes, error: fetchError } = await query;

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching notes', details: fetchError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Transform response to flatten relationship data
  const transformedNotes = (notes || []).map((note) => {
    const { coach_relationships, ...noteData } = note;
    return {
      ...noteData,
      relationship_status: (coach_relationships as { status: string })?.status,
    };
  });

  return new Response(
    JSON.stringify({ notes: transformedNotes }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /coach-notes?id=xxx
 * Delete a coach note
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
    .from('coach_notes')
    .select(`
      id,
      relationship_id,
      coach_relationships (coach_user_id)
    `)
    .eq('id', noteId)
    .single();

  if (fetchError || !existingNote) {
    return new Response(
      JSON.stringify({ error: 'Note not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is the coach who owns this note (if user_id provided)
  const coachUserId = (existingNote.coach_relationships as { coach_user_id: string })?.coach_user_id;
  if (userId && coachUserId !== userId) {
    return new Response(
      JSON.stringify({ error: 'You can only delete your own notes' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delete the note
  const { error: deleteError } = await supabaseClient
    .from('coach_notes')
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
