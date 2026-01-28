import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';
import { getCorsHeaders } from '../_shared/cors.ts';

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

// System prompt: ALL instructions for title generation
const SYSTEM_PROMPT = `# Role
You are a Lead Strategic Analyst. Your goal is to extract the single highest-value "North Star" outcome from call transcripts and format it into a premium, executive-level title.

# Input Data Format
The user will provide:
- Date: The date of the call
- Original Title: The original meeting title (often generic)
- Participants: Host info and external participants
- Transcript: The full call transcript

# 1. ENTITY & SPELLING NORMALIZATION (Crucial)
Before analyzing, scan the transcript for phonetic misspellings of proprietary tech, software, or names. **Infer the correct spelling based on context.**
- "cloud code" or "Cloud Code" → "Claude Code" (Anthropic's AI coding tool)
- "claude" in AI/Coding context → "Claude" (Anthropic)
- "roocode", "rue code", "roo code" → "RooCode"
- "Zapper" → "Zapier"
- "DSL" in video context → "VSL" (Video Sales Letter)
- "cursor" in AI coding context → "Cursor" (AI code editor)
- "wind surf" or "windsurf" in coding context → "Windsurf" (AI code editor)
*Action:* Use the CORRECTED proper nouns in your final title.

# 2. SIGNAL PRIORITIZATION (The Filter)
You must ignore "Water Cooler" talk unless it is the ONLY topic discussed.
- **Bad Signal:** "Surprise Uncle Visit" (This is noise, even if memorable).
- **Good Signal:** "Team Capacity Plan" (This is business value).
*Rule:* If a business decision, strategy, or blocker was discussed, THAT is the title. Personal stories are ignored.

# 3. EXTRACTION LOGIC (The "North Star")
Identify the **Highest Specificity Outcome** using this hierarchy:
1.  **The Breakthrough:** A new strategy or fix was discovered (e.g., "Cracked the 'Hook' Pattern").
2.  **The Decision:** A definitive choice was made (e.g., "Greenlit Hybrid VSL Script", "Killed the Side Hustle", "Ending Partnership - Going Solo").
3.  **The Diagnosis:** A specific problem was identified (e.g., "RooCode Integration Failure").
4.  **The Pivot:** A change in direction (e.g., "Pivot to Paid Ads", "Shutting Down VIP Offer").

**CRITICAL:** The title must capture WHAT was decided/changed, NOT what industry or topic area they work in. "Killed Side Hustle - Refocusing" is 100x better than "Commercial Real Estate Strategy".

# 4. TITLING RULES (Apple Aesthetic)
- **Format:** [Active Verb/Noun] + [Specific Context]
- **Length:** 3-7 Words. Ultra-concise.
- **Tone:** Professional, High-Agency, Precise.
- **Constraints:**
    - NO generic fillers (Meeting, Sync, Call, Chat, Session).
    - NO passive descriptions (e.g., "Discussion about...", "Creation of...").
    - NO weak verbs (e.g., "Successfully Installed..." -> "Integration Success").
    - NO industry/category labels as the title (e.g., "Commercial Real Estate Strategy" is BAD - too vague).
    - ALWAYS prefer the specific ACTION taken or DECISION made over describing the topic area.
    - If someone made a major life/business pivot, THAT is the title, not the industry they're in.

# Examples of "Weak" vs. "Premium" Correction
- *Weak:* "Ultimate Hook Pattern Creation - AI Comparison" (Too descriptive)
- *Premium:* "Optimizing Hook Patterns - AI Analysis"
- *Weak:* "Successfully Installed Claude Code via RueCode" (Too passive/wordy)
- *Premium:* "Claude Integration - RueCode Success"
- *Weak:* "Surprise Uncle Visit - Israel" (Distracted by noise)
- *Premium:* "Q4 Team Availability & Logistics" (The actual business context)
- *Weak:* "Approved VSL Script - Intro/Slides Hybrid" (Okay, but clunky)
- *Premium:* "Greenlit Hybrid VSL Strategy"
- *Weak:* "Commercial Real Estate AI Lead Generation" (Generic industry label)
- *Premium:* "Side Hustle Shutdown - Going Solo" (The actual decision made)
- *Weak:* "Agentic Coding Setup - GitHub Repository" (Too generic - what SPECIFIC setup?)
- *Premium:* "Multi-Agent Workflow Architecture" or "Cursor + Claude Integration" (The actual technical work)
- *Weak:* "AI Development Discussion" (Could apply to 1000 different calls)
- *Premium:* "Shipping RAG Pipeline v2" (Specific deliverable)

# VAGUENESS TEST (Apply Before Finalizing)
Before outputting your title, ask: **"Could this title apply to 10+ different calls?"**
- If YES → It's too vague. Find the SPECIFIC decision, breakthrough, or outcome.
- If NO → Good. The title is specific enough.

**Red Flags for Vague Titles:**
- Industry labels without action (e.g., "Real Estate Strategy", "AI Development")
- Generic tool mentions without context (e.g., "GitHub Repository", "Database Setup")
- Topic areas instead of outcomes (e.g., "Marketing Discussion", "Tech Review")

# 5. PARTICIPANT SUFFIX LOGIC (Crucial)
IF the call involves an external party (Sales, Coaching, Discovery, 1:1) AND has fewer than 3 participants:
**You MUST append the Counterpart's Name or Company.**
- *Logic:* The Host info is provided. Identify external participants who are NOT the host.
- *Format:* \`[Core Title] - [Name/Company]\`
- *Example:* \`Greenlit VSL Script - Acme Corp\`
- *Example:* \`Pipeline Review - Sarah Jones\`
- *Exception:* Do NOT add names for internal Team/Group calls (3+ participants) unless a specific person was the sole focus (e.g., a Performance Review).

# Output
Return ONLY the title string.`;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

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
        // Fetch call data including participant info
        const { data: call, error: callError } = await supabase
          .from('fathom_calls')
          .select('recording_id, title, full_transcript, created_at, recorded_by_name, recorded_by_email, calendar_invitees')
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

        // Build participant info for the prompt
        const hostName = call.recorded_by_name || 'Unknown';
        const hostEmail = call.recorded_by_email || '';

        // Parse calendar_invitees to get participant list
        type Invitee = { name?: string; email?: string; is_external?: boolean; email_domain?: string };
        const invitees: Invitee[] = Array.isArray(call.calendar_invitees) ? call.calendar_invitees : [];
        const participantCount = invitees.length;

        // Get external participants (not the host)
        const externalParticipants = invitees
          .filter((p: Invitee) => p.is_external && p.email !== hostEmail)
          .map((p: Invitee) => p.name || p.email || 'Unknown')
          .filter((name: string) => name !== 'Unknown');

        // Build participant summary for prompt
        let participantInfo = `Host: ${hostName} (${hostEmail})\n`;
        participantInfo += `Total Participants: ${participantCount}\n`;
        if (externalParticipants.length > 0 && externalParticipants.length <= 3) {
          participantInfo += `External Participants: ${externalParticipants.join(', ')}`;
        } else if (externalParticipants.length > 3) {
          participantInfo += `External Participants: ${externalParticipants.length} people (Group Call)`;
        }

        console.log(`Processing ${recordingId}: ${cleanedTranscript.length} chars, ${participantCount} participants`);

        // Generate title using Gemini 2.5 Flash via OpenRouter (1M context window)
        // System prompt = ALL instructions, User prompt = ONLY raw data variables
        const userPrompt = `Date: ${callDate}
Original Title: ${call.title}
Participants: ${participantInfo}
Transcript:
${cleanedTranscript}`;

        const result = await generateText({
          model: openrouter('google/gemini-2.5-flash'),
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          temperature: 0.7,
        });

        // Clean up the response - remove any quotes, markdown, or extra whitespace
        const aiTitle = result.text
          .trim()
          .replace(/^["'`]|["'`]$/g, '')  // Remove leading/trailing quotes and backticks
          .replace(/`/g, '')              // Remove any remaining backticks
          .replace(/\*\*/g, '')           // Remove markdown bold
          .replace(/\*/g, '')             // Remove markdown italic
          .replace(/\n/g, ' ')            // Remove newlines
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
