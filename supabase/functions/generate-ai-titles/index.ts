import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

// OpenRouter configuration - using official AI SDK v5 provider
function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

interface GenerateTitlesRequest {
  recordingIds?: number[];
  auto_discover?: boolean;  // Find all calls without AI titles
  limit?: number;           // Max calls to process when auto_discover is true
  user_id?: string;         // For internal service calls (bypasses JWT auth)
}

/**
 * Clean transcript to minimize token waste while preserving speaker attribution
 * Removes timestamps, excessive whitespace, and formatting cruft
 */
function cleanTranscript(transcript: string): string {
  return transcript
    // Remove timestamps like [00:00:00] or (00:00:00) or 00:00:00
    .replace(/[\[\(]?\d{1,2}:\d{2}(:\d{2})?[\]\)]?\s*/g, '')
    // Remove excessive newlines (more than 2 in a row)
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    // Normalize speaker labels (Speaker 1: -> Speaker 1:)
    .replace(/\s+:/g, ':')
    // Remove any remaining excessive spaces
    .replace(/  +/g, ' ')
    .trim();
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const NORTH_STAR_PROMPT = `**Situation**
You are processing raw call transcripts in a business context where calls span sales, internal operations, and coaching. Each transcript contains multiple potential focal points, but only one element represents the true "North Star"—the most valuable, high-stakes, or memorable aspect that distinguishes this conversation from all others.

**Task**
Extract the single most significant element from the provided call transcript and compress it into a precise, scannable title that immediately communicates the call's unique value or outcome.

**Objective**
Enable rapid identification and retrieval of specific calls from a large database by creating titles that capture the irreplaceable context of each conversation, eliminating ambiguity and generic labeling.

**Knowledge**
The transcript will be provided in the following format:
"""
Date: {date}
Original Title: {title}

Transcript:
{transcript}
"""

Apply a priority-based scanning methodology called the "North Star Protocol" to identify the Highest Specificity Identifier:

Priority 1 - The Decision: What was finalized, approved, or committed to?
Priority 2 - The Friction: What specific obstacle stopped or delayed progress?
Priority 3 - The Pivot: What strategic direction or approach changed?
Priority 4 - The Unique Identifier: What contextual detail makes this call impossible to confuse with another?

Category-Specific Extraction Logic:

**For Sales & Discovery Calls:**
- Closed/Won calls: Extract the primary driver, deal size, or unique closing factor
  - Example: "Closed $15k - Paid in Full" or "Onboarded - Rush Timeline for BFCM"
- Lost/Stalled calls: Extract the specific objection or blocking factor
  - Example: "Stalled - Partner Vetoed Price" or "DQ'd - Insufficient Lead Volume"
- Discovery calls: Extract the core pain point or unique business context
  - Example: "Discovery - Escaping Nightmare Agency" or "Triage - Scaling Past $50k/mo"

**For Team & Internal Calls:**
- Focus exclusively on the actionable result or decision made
  - Example: "Killed the Free Trial Offer" or "Approved New VSL Script" or "Resolved Zapier Webhook Error"

**For Coaching & Strategy Calls:**
- Extract the specific strategy implemented or breakthrough achieved
  - Example: "Pivot to Low-Ticket Funnel" or "Fixed Imposter Syndrome - Pricing" or "Mapping the Webinar Sequence"

**Title Construction Rules:**
- Structure: [Specific Outcome/Detail] - [Context] when context adds critical clarity
- Length: 4-8 words maximum
- Formatting: Title Case with no quotation marks
- Prohibited terms: Call, Meeting, Chat, Session, Sync, Touchbase, Discussion, Review (unless "Review" specifies a type, such as "Performance Review")
- The assistant should prioritize concrete nouns, specific verbs, and quantifiable details over abstract descriptors
- The assistant should avoid any word that could apply to multiple calls generically

**Output Format:**
Return only the title string with no preamble, explanation, or additional text.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body first to check for internal service call
    const body: GenerateTitlesRequest = await req.json();
    const { recordingIds, auto_discover, limit = 50, user_id: internalUserId } = body;

    let userId: string;

    // Check for internal service call (from webhook or other Edge Functions)
    // These calls include user_id in body and use service role key
    if (internalUserId) {
      // Validate the internal user_id exists
      const { data: userExists } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('user_id', internalUserId)
        .maybeSingle();

      if (!userExists) {
        return new Response(
          JSON.stringify({ error: 'Invalid user_id for internal call' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = internalUserId;
      console.log(`Internal service call for user: ${userId}`);
    } else {
      // External call - verify JWT authorization
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
      userId = user.id;
    }

    let idsToProcess: number[] = [];

    if (auto_discover) {
      // Find all calls without AI-generated titles
      console.log(`Auto-discovering calls without AI titles for user ${userId} (limit: ${limit})`);

      const { data: callsWithoutTitles, error: discoverError } = await supabase
        .from('fathom_calls')
        .select('recording_id')
        .eq('user_id', userId)
        .is('ai_generated_title', null)
        .not('full_transcript', 'is', null)  // Must have transcript
        .order('created_at', { ascending: false })
        .limit(limit);

      if (discoverError) {
        return new Response(
          JSON.stringify({ error: `Failed to discover calls: ${discoverError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      idsToProcess = (callsWithoutTitles || []).map(c => c.recording_id);
      console.log(`Found ${idsToProcess.length} calls needing AI titles`);

    } else if (recordingIds && recordingIds.length > 0) {
      idsToProcess = recordingIds;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either recordingIds or auto_discover=true is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (idsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No calls to process', totalProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating AI titles for ${idsToProcess.length} calls for user ${userId}`);

    const results = [];
    // Use OpenRouter for model access - Gemini 2.5 Flash for large context window
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    for (const recordingId of idsToProcess) {
      try {
        // Fetch call data
        const { data: call, error: callError } = await supabase
          .from('fathom_calls')
          .select('recording_id, title, full_transcript, created_at')
          .eq('recording_id', recordingId)
          .eq('user_id', userId)
          .single();

        if (callError || !call) {
          console.error(`Call ${recordingId} not found or unauthorized`);
          results.push({
            recordingId,
            success: false,
            error: 'Call not found or unauthorized',
          });
          continue;
        }

        // Skip if no transcript
        if (!call.full_transcript) {
          console.log(`Call ${recordingId} has no transcript to analyze`);
          results.push({
            recordingId,
            success: false,
            error: 'No transcript available',
          });
          continue;
        }

        // Clean and prepare the transcript
        const cleanedTranscript = cleanTranscript(call.full_transcript);
        const callDate = formatDate(call.created_at);

        // Build the content block
        const content = `Date: ${callDate}
Original Title: ${call.title}

Transcript:
${cleanedTranscript}`;

        console.log(`Processing ${recordingId}: ${cleanedTranscript.length} chars (cleaned from ${call.full_transcript.length})`);

        // Generate title using Gemini 2.5 Flash via OpenRouter (1M context window)
        const result = await generateText({
          model: openrouter('google/gemini-2.5-flash-preview'),
          prompt: NORTH_STAR_PROMPT.replace('{date}', callDate)
            .replace('{title}', call.title)
            .replace('{transcript}', cleanedTranscript),
        });

        // Clean up the response - remove any quotes or extra whitespace
        const aiTitle = result.text
          .trim()
          .replace(/^["']|["']$/g, '')  // Remove leading/trailing quotes
          .replace(/\n/g, ' ')          // Remove newlines
          .trim();

        console.log(`Generated for ${recordingId}: "${aiTitle}"`);

        // Update database with AI-generated title and timestamp
        const { error: updateError } = await supabase
          .from('fathom_calls')
          .update({
            ai_generated_title: aiTitle,
            ai_title_generated_at: new Date().toISOString(),
          })
          .eq('recording_id', recordingId)
          .eq('user_id', userId);

        if (updateError) {
          console.error(`Error updating title for ${recordingId}:`, updateError);
          results.push({
            recordingId,
            success: false,
            error: updateError.message,
          });
        } else {
          results.push({
            recordingId,
            success: true,
            originalTitle: call.title,
            aiGeneratedTitle: aiTitle,
          });
        }
      } catch (error) {
        console.error(`Error processing ${recordingId}:`, error);
        results.push({
          recordingId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed: idsToProcess.length,
        successCount,
        failureCount: idsToProcess.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate titles error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
