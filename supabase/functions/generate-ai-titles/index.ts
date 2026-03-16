import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';
import { getCorsHeaders } from '../_shared/cors.ts';
import { startTrace, flushLangfuse } from '../_shared/langfuse.ts';
import { logUsage, estimateTokenCount } from '../_shared/usage-tracker.ts';

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
  respectPreference?: boolean; // When true, skip if user has autoProcessingTitleGeneration=false
}

/**
 * Clean transcript to minimize token waste while preserving speaker attribution
 * Removes timestamps, excessive whitespace, and formatting cruft
 */
function cleanTranscript(transcript: string): string {
  return transcript
    // Remove timestamps like [00:00:00] or (00:00:00) or 00:00:00
    .replace(/[[(]?\d{1,2}:\d{2}(:\d{2})?[\])]?\s*/g, '')
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

// Model config — production values per issue #155
const AI_MODEL = 'google/gemini-2.5-flash-lite';
const AI_TEMPERATURE = 0.1;

// System prompt: Full Lead Strategic Analyst prompt (issue #155)
const SYSTEM_PROMPT = `You are a Lead Strategic Analyst. Your goal is to extract the single highest-value title from a call transcript that accurately reflects either the primary theme of the session, the most critical decision or breakthrough made, or the outcome of a focused 1:1 interaction — depending on call type and purpose.

# INPUT DATA FORMAT

The user will provide:

- Date: The date of the call
- Original Title: The original meeting title (often generic)
- Participants: Host info and external participants
- Transcript: The full call transcript

---

# STEP 1 — ENTITY & SPELLING NORMALIZATION

Before analyzing, scan the transcript for phonetic misspellings of proprietary tech, software, or names. Infer the correct spelling based on context.

- "cloud code" → "Claude Code"
- "roocode", "rue code" → "RooCode"
- "Zapper" → "Zapier"
- "DSL" in video context → "VSL"
- "cursor" in AI coding context → "Cursor"
- "wind surf" in coding context → "Windsurf"
- "open claw" → "OpenClaw"
- "composio" → "Composio"
- "soaring", "soarin" in agent context → "Soren" (AI agent persona)
- "claude" in AI/coding context → "Claude" (Anthropic)

Use corrected proper nouns in your final title.

---

# STEP 2 — CALL TYPE CLASSIFICATION

Classify the call before doing anything else. This determines your entire extraction strategy.

**Type A — Focused 1:1 Call**
Signals: 1–2 external participants, under 90 minutes, single external party, clear single agenda.
Strategy: Identify call purpose first (see Step 3), then extract the outcome or North Star.

**Type B — Community / Group Session**
Signals: 3+ participants OR runtime over 90 minutes, multiple agenda items, host is teaching or demo-ing.
Strategy: Identify the dominant activity (consumed 40%+ of the session) plus the single most impressive or novel thing demonstrated. A narrow technical sub-step that took under 25% of call time CANNOT headline the title.

**Type C — Hybrid Teaching / Build Session**
Signals: 2 participants, 90+ minutes, host is clearly building or teaching live.
Strategy: Same as Type B. Title what was taught and built, not any one sub-task.

---

# STEP 3 — PURPOSE DETECTION (Type A calls only)

Before extracting content, identify WHY this call happened. Scan for these signals:

| Purpose | Signals in Transcript |
|---|---|
| Sales / Discovery | Pricing discussed, objections handled, next steps proposed, product pitched, close attempted |
| Onboarding | Setup walkthrough, account creation, getting started, first-time configuration |
| Coaching / Strategy | Host giving advice, reviewing performance, building a plan for the client |
| Check-in / Support | Troubleshooting, issue resolution, status update on existing engagement |
| Partnership / Collab | Two parties exploring working together, referral arrangements, JV discussion |
| Interview / Podcast | Q&A format, one person asking structured questions, recording for an audience |

Once purpose is identified, apply the matching title format:

- **Closed Sale** → \`Closed $[X] - [Context]\` or \`[Product] Sale - [Name]\`
- **No Close / Lost** → \`[Product] Discovery - [Name]\` or \`Lost Deal - [Reason] - [Name]\`
- **Onboarding** → \`[Name] Onboarding - [Key Setup Milestone]\`
- **Coaching** → \`[Core Advice Given] - [Name]\`
- **Check-in / Support** → \`[Issue Resolved or Diagnosed] - [Name]\`
- **Partnership** → \`Referral Deal - [Name]\` or \`Partnership Discussion - [Name]\`
- **Interview** → \`[Topic of Interview] - [Show or Host Name]\`

**Outcome modifier rule:** If the call had a definitive win or loss, that result leads the title. "Closed," "Lost," "Resolved," "Greenlit," "Killed" — these are the first word whenever the outcome is clear.

---

# STEP 4 — SIGNAL FILTERING (All call types)

Ignore personal and social chatter unless it is the ONLY content. Wins roundtables, bathroom breaks, family interruptions, and water-cooler talk are noise. If a business decision, strategy, demo, or blocker was discussed, that is your signal.

---

# STEP 5 — EXTRACTION LOGIC

**For Type A calls** — Purpose anchors the title (from Step 3). Then apply the North Star hierarchy for the content after the dash:

1. The Breakthrough: A new strategy or fix was discovered
2. The Decision: A definitive choice was made
3. The Diagnosis: A specific problem was identified
4. The Pivot: A change in direction

**For Type B / C calls** — Apply the Session Theme framework:

1. What was the dominant activity? (The thing the host spent the most time doing or explaining)
2. What was the single most impressive or novel element introduced? (A tool, a live demo result, a new concept)
3. Combine: [Dominant Activity] - [Novel Element or Key Concept]

Do NOT extract a narrow technical sub-action (connecting an API, fixing DNS, renaming a file) as the primary title element for a Type B/C call. Those details belong after the dash only if they were the entire point of the session.

---

# STEP 6 — TITLING RULES

- Format: [Active Verb/Noun] + [Specific Context]
- Length: 3–7 words. Ultra-concise.
- Tone: Professional, high-agency, precise.
- NO generic fillers: Meeting, Sync, Call, Chat, Session
- NO passive descriptions: "Discussion about…", "Creation of…"
- NO weak verbs: "Successfully Installed…" → "Integration Success"
- NO industry/category labels as the title: "Commercial Real Estate Strategy" says nothing about what happened
- ALWAYS prefer the specific activity, decision, outcome, or theme over a topic area label
- For Type A: the title should answer "what happened on this call and with whom?"
- For Type B/C: the title should answer "what would I learn or see if I watched this recording?"

---

# STEP 7 — VAGUENESS TESTS (Run both before finalizing)

**Specificity Test:** Could this title apply to 10+ different calls? If yes, it's too vague. Find the specific decision, theme, or outcome.

**Scope Test (Type B/C only):** Does this title reflect what consumed the bulk of the session, or just one sub-task? If the element in the title took under 25% of call time, it cannot lead the title.

Red flags:

- Industry labels without action ("Real Estate Strategy", "AI Development")
- Generic tool mentions without context ("GitHub Setup", "Database Config")
- Topic areas instead of outcomes or activities ("Marketing Discussion", "Tech Review")
- A narrow API or integration step headlining a 3-hour session
- Purpose missing from a Type A title (no indication it was a sale, onboarding, coaching call, etc.)

---

# STEP 8 — PARTICIPANT SUFFIX LOGIC

**Type A calls:** Always append the counterpart's name or company.

- Format: [Core Title] - [Name or Company]
- Example: \`Closed $497 - John Smith\` or \`Grace Onboarding - Phil Tomlinson\`

**Type B/C calls:** Do NOT add individual names unless one specific external person was the sole focus (e.g., a guest interview or a public performance review).

---

# CALIBRATION EXAMPLES

**Type A — Sales:**
- Closed deal → \`Closed $49 Trial - Sarah Jones\`
- No close → \`CallVault Discovery - Mike Reynolds\`
- Lost deal → \`Lost Deal - Pricing Objection - Dan Ford\`

**Type A — Onboarding:**
- \`Grace Setup - Phil Tomlinson\`
- \`AI Simple Onboarding - Brett Bennett\`

**Type A — Coaching:**
- \`Presentation Strategy - Phil Tomlinson\`
- \`Offer Positioning - Daniel Marama\`

**Type A — Partnership:**
- \`Referral Deal Scoped - Phil Tomlinson\`
- \`JV Discussion - Los Silva\`

**Type A — Interview:**
- \`OpenClaw Deep Dive - Substack Podcast\`

**Type B/C — Weak → Premium:**
- "Activate Stripe Integration in Composio" → \`Live Funnel Build - Skills + Composio Demo\`
- "Community Call March 3" → \`Live $49 Offer Build - Claude Code + Composio\`
- "AI Development Discussion" → \`Shipping RAG Pipeline v2\`
- "OpenClaw Setup and GitHub Repository" → \`Multi-Agent Workflow Architecture\`
- "Successfully Installed Claude Code via RooCode" → \`Claude Code + RooCode Integration\`
- "Approved VSL Script - Intro/Slides Hybrid" → \`Greenlit Hybrid VSL Strategy\`
- "Commercial Real Estate AI Lead Generation" → \`Side Hustle Shutdown - Going Solo\`

---

# OUTPUT

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
    const { recordingIds, auto_discover, limit = 50, user_id: internalUserId, respectPreference = false } = body;

    let userId: string;

    // Check for internal service call (from webhook or other Edge Functions)
    // These calls include user_id in body AND must carry the service role key as the
    // Authorization token — this prevents unauthenticated clients from bypassing JWT
    // by simply including a user_id in the request body.
    if (internalUserId) {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      if (token !== supabaseServiceKey) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized internal call' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check auto_naming_enabled setting.
      // A null result (no settings row yet — new user) is treated as enabled because
      // the column default is true. Only an explicit false blocks auto-naming.
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('auto_naming_enabled')
        .eq('user_id', internalUserId)
        .maybeSingle();

      if (userSettings?.auto_naming_enabled === false) {
        console.log(`Auto-naming disabled for user ${internalUserId} — skipping`);
        return new Response(
          JSON.stringify({ success: true, message: 'Auto-naming disabled for this user', totalProcessed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Check user preference when called from automated pipeline
    if (respectPreference) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('auto_processing_preferences')
        .eq('user_id', userId)
        .maybeSingle();

      const prefs = profile?.auto_processing_preferences as { autoProcessingTitleGeneration?: boolean } | null;
      if (prefs?.autoProcessingTitleGeneration !== true) {
        console.log(`Auto-naming disabled for user ${userId}, skipping`);
        return new Response(
          JSON.stringify({ success: true, message: 'Auto-naming disabled by user preference', totalProcessed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let idsToProcess: number[] = [];

    if (auto_discover) {
      // Find all calls without AI-generated titles
      console.log(`Auto-discovering calls without AI titles for user ${userId} (limit: ${limit})`);

      const { data: callsWithoutTitles, error: discoverError } = await supabase
        .from('fathom_raw_calls')
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
      // Filter out NaN/null values that occur when UUID-based recordings are passed
      idsToProcess = recordingIds.filter(id => id != null && !isNaN(id) && id > 0);
      if (idsToProcess.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid legacy recording IDs provided. This feature requires Fathom-sourced calls with integer recording IDs.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
          .from('fathom_raw_calls')
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

        // Generate title using Gemini 2.5 Flash Lite via OpenRouter (1M context window)
        // System prompt = ALL instructions, User prompt = ONLY raw data variables
        const userPrompt = `Date: ${callDate}
Original Title: ${call.title}
Participants: ${participantInfo}
Transcript:
${cleanedTranscript}`;

        // Start Langfuse trace
        const trace = startTrace({
          name: 'generate-ai-titles',
          userId,
          model: AI_MODEL,
          input: { system: SYSTEM_PROMPT, user: userPrompt.substring(0, 500) + '...' },
          metadata: { recordingId, transcriptLength: cleanedTranscript.length },
        });

        const startMs = Date.now();
        let result;
        try {
          result = await generateText({
            model: openrouter(AI_MODEL),
            system: SYSTEM_PROMPT,
            prompt: userPrompt,
            temperature: AI_TEMPERATURE,
          });
          await trace?.end(result.text);
        } catch (error) {
          await trace?.end(null, error instanceof Error ? error.message : 'Unknown error');
          throw error;
        }
        const latencyMs = Date.now() - startMs;

        // Track usage — fire-and-forget, does not block the main flow
        // ai@5.x uses inputTokens/outputTokens (not promptTokens/completionTokens)
        const inputTokens = result.usage?.inputTokens ?? estimateTokenCount(SYSTEM_PROMPT + userPrompt);
        const outputTokens = result.usage?.outputTokens ?? estimateTokenCount(result.text);
        logUsage(supabase, {
          userId,
          operationType: 'ai_naming',
          model: AI_MODEL,
          inputTokens,
          outputTokens,
          recordingId,
          latencyMs,
        }).catch((err) => console.error('Usage logging failed (non-blocking):', err));

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

        // Update fathom_raw_calls with AI-generated title and timestamp
        const { error: updateError } = await supabase
          .from('fathom_raw_calls')
          .update({
            ai_generated_title: aiTitle,
            ai_title_generated_at: new Date().toISOString(),
          })
          .eq('recording_id', recordingId)
          .eq('user_id', userId);

        if (updateError) {
          console.error(`Error updating fathom_raw_calls title for ${recordingId}:`, updateError);
          results.push({
            recordingId,
            success: false,
            error: updateError.message,
          });
        } else {
          // Also update recordings.title so the UI reflects the AI title immediately.
          // recordings.legacy_recording_id (bigint) matches fathom_raw_calls.recording_id.
          // Non-blocking: a failure here doesn't fail the overall result.
          const { error: recError } = await supabase
            .from('recordings')
            .update({ title: aiTitle })
            .eq('owner_user_id', userId)
            .eq('legacy_recording_id', recordingId);

          if (recError) {
            console.error(`Error updating recordings.title for legacy_recording_id ${recordingId} (non-blocking):`, recError);
          }

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

    // Flush Langfuse traces before response
    await flushLangfuse();

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
    await flushLangfuse();
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
