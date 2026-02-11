import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * YouTube Import Edge Function
 * 
 * Orchestrates the import of YouTube videos as call transcripts:
 * 1. Validates YouTube URL and extracts video ID
 * 2. Checks for duplicate imports
 * 3. Fetches video metadata via youtube-api function
 * 4. Fetches transcript via youtube-api function
 * 5. Creates fathom_calls record with source_platform='youtube'
 * 
 * The existing embedding pipeline will pick up new records for processing.
 */

interface ImportRequest {
  videoUrl: string;
  vault_id?: string;
}

type ImportStep = 'validating' | 'checking' | 'fetching' | 'transcribing' | 'processing' | 'done';

interface ImportResponse {
  success: boolean;
  step: ImportStep;
  error?: string;
  recordingId?: number;
  title?: string;
  exists?: boolean;
}

/**
 * Extract video ID from various YouTube URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - Direct video ID (11 characters, alphanumeric + _ -)
 */
function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  
  // Check if it's a direct video ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try various URL patterns
  const patterns = [
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URL: youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // Old embed URL: youtube.com/v/VIDEO_ID
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    // With www or without
    /(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Generate a unique recording_id for YouTube imports
 * Uses timestamp-based approach with a prefix to avoid collision with Fathom IDs
 * YouTube recording IDs use the 9000000000000+ range
 */
function generateYouTubeRecordingId(): number {
  // Use 9000000000000 as base to avoid collision with Fathom's recording IDs
  // Add timestamp in milliseconds to ensure uniqueness
  const base = 9000000000000;
  const timestamp = Date.now();
  return base + timestamp;
}

/**
 * Parse ISO 8601 duration (e.g., "PT1H2M10S") to seconds
 * Used to populate recordings.duration field
 */
function parseDurationToSeconds(iso8601: string | undefined | null): number | null {
  if (!iso8601 || typeof iso8601 !== 'string') return null;
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const secs = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + secs;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'No authorization header' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    // Store the user's JWT token to pass to internal function calls
    const userJwtToken = token;

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'Unauthorized' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ImportRequest = await req.json();
    
    if (!body.videoUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'Missing videoUrl in request body' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`YouTube import request - User: ${user.id}, URL: ${body.videoUrl}`);

    // ========================================================================
    // Step 0: Ensure YouTube vault exists (auto-create on first import)
    // ========================================================================
    let youtubeVaultId: string | null = body.vault_id || null;

    if (!youtubeVaultId) {
      try {
        // Find user's personal bank via bank_memberships
        const { data: bankMembership, error: bankError } = await supabase
          .from('bank_memberships')
          .select('bank_id, banks!inner(id, type)')
          .eq('user_id', user.id)
          .eq('banks.type', 'personal')
          .maybeSingle();

        if (bankError) {
          console.error('Error finding personal bank:', bankError);
        }

        const personalBankId = bankMembership?.bank_id;

        if (personalBankId) {
          // Check for existing YouTube vault in that bank
          const { data: existingVault, error: vaultCheckError } = await supabase
            .from('vaults')
            .select('id')
            .eq('bank_id', personalBankId)
            .eq('vault_type', 'youtube')
            .maybeSingle();

          if (vaultCheckError) {
            console.error('Error checking for YouTube vault:', vaultCheckError);
          }

          if (existingVault) {
            youtubeVaultId = existingVault.id;
            console.log(`Found existing YouTube vault: ${youtubeVaultId}`);
          } else {
            // Create YouTube vault
            const { data: newVault, error: createVaultError } = await supabase
              .from('vaults')
              .insert({
                bank_id: personalBankId,
                name: 'YouTube Vault',
                vault_type: 'youtube',
              })
              .select('id')
              .single();

            if (createVaultError) {
              console.error('Error creating YouTube vault:', createVaultError);
            } else if (newVault) {
              youtubeVaultId = newVault.id;
              console.log(`Created YouTube vault: ${youtubeVaultId}`);

              // Create vault_membership for user as vault_owner
              const { error: membershipError } = await supabase
                .from('vault_memberships')
                .insert({
                  vault_id: newVault.id,
                  user_id: user.id,
                  role: 'vault_owner',
                });

              if (membershipError) {
                console.error('Error creating vault membership:', membershipError);
              }
            }
          }
        }
      } catch (vaultSetupError) {
        // Never block import on vault auto-creation failures
        console.error('Error in YouTube vault auto-creation:', vaultSetupError);
      }
    }

    // ========================================================================
    // Step 1: Validate URL and extract video ID
    // ========================================================================
    const videoId = extractVideoId(body.videoUrl);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'Invalid YouTube URL. Supported formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, or direct 11-character video ID' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted video ID: ${videoId}`);

    // ========================================================================
    // Step 2: Check for duplicate import
    // ========================================================================
    const { data: existingCall, error: checkError } = await supabase
      .from('fathom_calls')
      .select('recording_id, title')
      .eq('user_id', user.id)
      .eq('source_platform', 'youtube')
      .filter('metadata->>youtube_video_id', 'eq', videoId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for duplicate:', checkError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'checking' as ImportStep,
          error: 'Failed to check for existing imports' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingCall) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'checking' as ImportStep,
          error: 'Video already imported',
          exists: true,
          recordingId: existingCall.recording_id,
          title: existingCall.title
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // Step 3: Fetch video details via youtube-api function
    // ========================================================================
    const detailsResponse = await fetch(
      `${supabaseUrl}/functions/v1/youtube-api`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userJwtToken}`,
        },
        body: JSON.stringify({
          action: 'video-details',
          params: { videoId },
        }),
      }
    );

    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      console.error('Failed to fetch video details:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'fetching' as ImportStep,
          error: 'Failed to fetch video details. The video may be private or unavailable.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const detailsResult = await detailsResponse.json();
    
    if (!detailsResult.success || !detailsResult.data) {
      console.error('Video details response error:', detailsResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'fetching' as ImportStep,
          error: detailsResult.error || 'Failed to fetch video details' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoDetails = detailsResult.data;
    console.log(`Fetched video details: "${videoDetails.title}"`);

    // ========================================================================
    // Step 4: Fetch transcript via youtube-api function
    // ========================================================================
    const transcriptResponse = await fetch(
      `${supabaseUrl}/functions/v1/youtube-api`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userJwtToken}`,
        },
        body: JSON.stringify({
          action: 'transcript',
          params: { videoId },
        }),
      }
    );

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('Failed to fetch transcript:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'transcribing' as ImportStep,
          error: 'Transcript not available for this video. Ensure the video has captions enabled.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcriptResult = await transcriptResponse.json();
    
    if (!transcriptResult.success || !transcriptResult.data?.transcript) {
      console.error('Transcript response error:', transcriptResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'transcribing' as ImportStep,
          error: transcriptResult.error || 'Transcript not available for this video' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcriptText = transcriptResult.data.transcript;
    console.log(`Fetched transcript: ${transcriptText.length} characters`);

    // ========================================================================
    // Step 5: Create fathom_calls record
    // ========================================================================
    const recordingId = generateYouTubeRecordingId();
    
    // Prepare metadata JSONB
    const metadata = {
      youtube_video_id: videoId,
      youtube_channel_id: videoDetails.channelId,
      youtube_channel_title: videoDetails.channelTitle,
      youtube_description: (videoDetails.description || '').substring(0, 1000), // Truncate to 1000 chars
      youtube_thumbnail: videoDetails.thumbnails?.high?.url || videoDetails.thumbnails?.default?.url,
      youtube_duration: videoDetails.duration,
      youtube_view_count: videoDetails.viewCount,
      youtube_like_count: videoDetails.likeCount,
      import_source: 'youtube-import',
      imported_at: new Date().toISOString(),
    };

    // Parse publishedAt date for recording_start_time
    const publishedAt = videoDetails.publishedAt 
      ? new Date(videoDetails.publishedAt).toISOString()
      : new Date().toISOString();

    const insertData = {
      recording_id: recordingId,
      user_id: user.id,
      title: videoDetails.title,
      full_transcript: transcriptText,
      recording_start_time: publishedAt,
      created_at: new Date().toISOString(),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      source_platform: 'youtube',
      metadata: metadata,
      // Set deduplication fields
      is_primary: true,
      transcript_source: 'native', // YouTube's native captions
    };

    const { error: insertError } = await supabase
      .from('fathom_calls')
      .insert(insertData);

    if (insertError) {
      console.error('Error inserting call record:', insertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'processing' as ImportStep,
          error: 'Failed to save video import' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully imported YouTube video as recording_id: ${recordingId}`);

    // ========================================================================
    // Step 6: Create recording in recordings table + vault entry
    // ========================================================================
    let newRecordingUuid: string | null = null;

    try {
      // Find user's bank for recording ownership
      const { data: userBank } = await supabase
        .from('bank_memberships')
        .select('bank_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (userBank?.bank_id) {
        // Parse duration to seconds for recordings table
        const durationSeconds = parseDurationToSeconds(videoDetails.duration);

        // Build source_metadata matching YouTubeVideoMetadata interface
        const sourceMetadata = {
          youtube_video_id: videoId,
          youtube_channel_id: videoDetails.channelId,
          youtube_channel_title: videoDetails.channelTitle,
          youtube_description: (videoDetails.description || '').substring(0, 1000),
          youtube_thumbnail: videoDetails.thumbnails?.high?.url || videoDetails.thumbnails?.default?.url,
          youtube_duration: videoDetails.duration,
          youtube_view_count: videoDetails.viewCount,
          youtube_like_count: videoDetails.likeCount,
          youtube_comment_count: videoDetails.commentCount || null,
          youtube_category_id: videoDetails.categoryId || null,
          import_source: 'youtube-import',
          imported_at: new Date().toISOString(),
        };

        // Create recording directly in recordings table
        const { data: newRecording, error: recordingInsertError } = await supabase
          .from('recordings')
          .insert({
            bank_id: userBank.bank_id,
            owner_user_id: user.id,
            legacy_recording_id: recordingId,
            title: videoDetails.title,
            full_transcript: transcriptText,
            source_app: 'youtube',
            source_metadata: sourceMetadata,
            duration: durationSeconds,
            recording_start_time: publishedAt,
            global_tags: [],
          })
          .select('id')
          .single();

        if (recordingInsertError) {
          console.error('Error creating recording:', recordingInsertError);
        } else if (newRecording) {
          newRecordingUuid = newRecording.id;
          console.log(`Created recording ${newRecordingUuid} with source_metadata`);
        }
      }
    } catch (recordingError) {
      // Never block import on recording table failures
      console.error('Error creating recording entry:', recordingError);
    }

    // Create vault entry linking recording to YouTube vault
    if (youtubeVaultId && newRecordingUuid) {
      try {
        // Validate vault membership
        const { data: membership, error: membershipError } = await supabase
          .from('vault_memberships')
          .select('id')
          .eq('vault_id', youtubeVaultId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (membershipError) {
          console.error('Error checking vault membership:', membershipError);
        } else if (!membership) {
          console.warn(`User ${user.id} is not a member of vault ${youtubeVaultId}, skipping vault entry`);
        } else {
          const { error: vaultEntryError } = await supabase
            .from('vault_entries')
            .insert({
              vault_id: youtubeVaultId,
              recording_id: newRecordingUuid,
            });

          if (vaultEntryError) {
            // Don't fail the whole import for vault entry issues
            console.error('Error creating vault entry:', vaultEntryError);
          } else {
            console.log(`Created vault entry for recording ${newRecordingUuid} in vault ${youtubeVaultId}`);
          }
        }
      } catch (vaultError) {
        // Never fail the import due to vault entry issues
        console.error('Error handling vault entry:', vaultError);
      }
    }

    // ========================================================================
    // Step 7: Return success
    // ========================================================================
    const response: ImportResponse = {
      success: true,
      step: 'done',
      recordingId: recordingId,
      title: videoDetails.title,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('YouTube import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        step: 'processing' as ImportStep,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
