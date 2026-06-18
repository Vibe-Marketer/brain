import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@6.0.66';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { startTrace, flushLangfuse } from '../_shared/langfuse.ts';
import { authenticateRequest } from '../_shared/auth.ts';

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Google Gemini REST API — direct call, no SDK dependency issues
// ---------------------------------------------------------------------------
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; code?: number };
}

// recordingId is the Fathom BIGINT for fathom_raw_calls-backed calls, or the
// canonical recordings UUID (string) for UUID-keyed recordings (cross-org copies,
// Zoom, manual uploads) processed via the canonical path.
type GenerateTitleResult =
  | {
      recordingId: number | string;
      success: true;
      originalTitle: string;
      aiGeneratedTitle: string;
    }
  | {
      recordingId: number | string;
      success: false;
      error: string;
    };

async function callGeminiDirect(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errBody}`);
  }

  const data: GeminiResponse = await res.json();
  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

  return { text, inputTokens, outputTokens };
}

// OpenRouter configuration — fallback if Google AI key is not set
function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

const generateTitlesSchema = z.object({
  recordingIds: z.array(z.number().int().positive()).max(100).optional(),
  // Canonical recordings.id (UUID) for recordings with no Fathom numeric ID —
  // cross-org copies, Zoom, manual uploads. Titled from the recordings row directly.
  canonicalRecordingIds: z.array(z.string().uuid()).max(100).optional(),
  auto_discover: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional().default(50),
  user_id: z.string().uuid().optional(),
  respectPreference: z.boolean().optional().default(false),
});

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
// Google direct uses 'gemini-2.5-flash-lite', OpenRouter uses 'google/gemini-2.5-flash-lite'
const GOOGLE_AI_MODEL = 'gemini-2.5-flash-lite';
const OPENROUTER_AI_MODEL = 'google/gemini-2.5-flash-lite';
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
    // service-role required: rewrites recording titles across many recordings in one invocation; AI gating happens in track-ai-usage.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!googleApiKey && !openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'No AI provider API key configured (GOOGLE_AI_API_KEY or OPENROUTER_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prefer Google AI direct, fall back to OpenRouter
    const useGoogleDirect = !!googleApiKey;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate body
    const rawBody = await req.json();
    const validation = generateTitlesSchema.safeParse(rawBody);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recordingIds, canonicalRecordingIds, auto_discover, limit, user_id: internalUserId, respectPreference } = validation.data;

    let userId: string;

    // Normal app calls authenticate with the user's Supabase JWT and do not pass
    // user_id. Internal fan-out may pass user_id only when invoked with the
    // service-role token so webhook processors can generate titles for synced users.
    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (internalUserId && bearerToken === supabaseServiceKey) {
      userId = internalUserId;
    } else {
      const authResult = await authenticateRequest(req, supabase, corsHeaders);
      if (authResult instanceof Response) return authResult;
      userId = authResult.userId;

      if (internalUserId && internalUserId !== userId) {
        return new Response(
          JSON.stringify({ error: 'Cannot generate titles for another user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
    // Canonical UUID-keyed recordings (cross-org copies, Zoom, manual). De-duped,
    // and only used when not auto-discovering (auto_discover targets Fathom calls).
    const uuidsToProcess: string[] = auto_discover
      ? []
      : Array.from(new Set((canonicalRecordingIds ?? []).filter((u): u is string => typeof u === 'string' && u.length > 0)));

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

    } else if ((recordingIds && recordingIds.length > 0) || uuidsToProcess.length > 0) {
      // Filter out NaN/null values that occur when UUID-based recordings are passed
      // in the numeric array. UUID-keyed recordings travel in canonicalRecordingIds.
      idsToProcess = (recordingIds ?? []).filter(id => id != null && !isNaN(id) && id > 0);
      if (idsToProcess.length === 0 && uuidsToProcess.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid recording IDs provided. Provide Fathom integer recordingIds and/or canonicalRecordingIds (UUIDs).' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Either recordingIds, canonicalRecordingIds, or auto_discover=true is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (idsToProcess.length === 0 && uuidsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No calls to process', totalProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating AI titles for ${idsToProcess.length} Fathom + ${uuidsToProcess.length} canonical calls for user ${userId}`);

    const results: GenerateTitleResult[] = [];
    const AI_MODEL = useGoogleDirect ? GOOGLE_AI_MODEL : OPENROUTER_AI_MODEL;
    console.log(`Using ${useGoogleDirect ? 'Google AI direct' : 'OpenRouter'} with model ${AI_MODEL}`);

    type Invitee = { name?: string; email?: string; is_external?: boolean; email_domain?: string };

    // Runs the title model with the same 2-attempt retry + cleanup used by the
    // Fathom path. Returns the cleaned title, or null when the model keeps
    // returning over-long reasoning instead of a title. Throws on API error.
    const generateTitleWithModel = async (
      userPrompt: string,
      traceKey: number | string,
      transcriptLength: number,
    ): Promise<string | null> => {
      const trace = startTrace({
        name: 'generate-ai-titles',
        userId,
        model: AI_MODEL,
        input: { system: SYSTEM_PROMPT, user: userPrompt.substring(0, 500) + '...' },
        metadata: { recordingId: traceKey, transcriptLength },
      });

      const MAX_TITLE_LENGTH = 100;
      const MAX_ATTEMPTS = 2;
      let aiTitle = '';

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const currentPrompt = attempt === 1
          ? userPrompt
          : userPrompt + '\n\nIMPORTANT: Return ONLY the title string. No reasoning, no steps, no explanation. Just the title.';
        const currentTemp = attempt === 1 ? AI_TEMPERATURE : 0.3;

        let resultText: string;
        try {
          if (useGoogleDirect) {
            const geminiResult = await callGeminiDirect(
              googleApiKey!, GOOGLE_AI_MODEL, SYSTEM_PROMPT, currentPrompt, currentTemp,
            );
            resultText = geminiResult.text;
          } else {
            const openrouter = createOpenRouterProvider(openrouterApiKey!);
            const result = await generateText({
              model: openrouter(OPENROUTER_AI_MODEL),
              system: SYSTEM_PROMPT,
              prompt: currentPrompt,
              temperature: currentTemp,
            });
            resultText = result.text;
          }
          await trace?.end(resultText);
        } catch (error) {
          await trace?.end(null, error instanceof Error ? error.message : 'Unknown error');
          throw error;
        }

        aiTitle = resultText
          .trim()
          .replace(/^["'`]|["'`]$/g, '')
          .replace(/`/g, '')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/\n/g, ' ')
          .trim();

        if (aiTitle.length <= MAX_TITLE_LENGTH) {
          if (attempt > 1) console.log(`Retry succeeded for ${traceKey}: "${aiTitle}"`);
          return aiTitle;
        }

        if (attempt < MAX_ATTEMPTS) {
          console.warn(`Title for ${traceKey} is ${aiTitle.length} chars on attempt ${attempt} — retrying with stronger instruction.`);
        } else {
          console.error(`Title for ${traceKey} still ${aiTitle.length} chars after ${MAX_ATTEMPTS} attempts — skipping.`);
        }
      }

      return null;
    };

    // Canonical UUID path: titles a recording straight from the recordings row.
    // Used for cross-org copies and other recordings that have no Fathom numeric
    // ID (and therefore no fathom_raw_calls row). The transcript is copied onto
    // the recordings row, so everything needed is present here. Title is written
    // back to recordings.ai_generated_title; get_workspace_recordings surfaces it.
    const processCanonicalRecording = async (canonicalId: string) => {
      try {
        const { data: rec, error: recError } = await supabase
          .from('recordings')
          .select('id, title, full_transcript, created_at, source_metadata')
          .eq('id', canonicalId)
          .eq('owner_user_id', userId)
          .single();

        if (recError || !rec) {
          console.error(`Recording ${canonicalId} not found or unauthorized`);
          results.push({ recordingId: canonicalId, success: false, error: 'Recording not found or unauthorized' });
          return;
        }

        if (!rec.full_transcript) {
          console.log(`Recording ${canonicalId} has no transcript to analyze`);
          results.push({ recordingId: canonicalId, success: false, error: 'No transcript available' });
          return;
        }

        const cleanedTranscript = cleanTranscript(rec.full_transcript);
        const callDate = formatDate(rec.created_at);

        // Participant info for copies/Zoom/manual lives in source_metadata, not
        // as dedicated columns. Fall back gracefully when absent.
        const meta = (rec.source_metadata ?? {}) as Record<string, unknown>;
        const hostName = (meta.recorded_by_name as string) || 'Unknown';
        const hostEmail = (meta.recorded_by_email as string) || '';
        const invitees: Invitee[] = Array.isArray(meta.calendar_invitees) ? (meta.calendar_invitees as Invitee[]) : [];
        const participantCount = invitees.length;
        const externalParticipants = invitees
          .filter((p) => p.is_external && p.email !== hostEmail)
          .map((p) => p.name || p.email || 'Unknown')
          .filter((name) => name !== 'Unknown');

        let participantInfo = `Host: ${hostName} (${hostEmail})\n`;
        participantInfo += `Total Participants: ${participantCount}\n`;
        if (externalParticipants.length > 0 && externalParticipants.length <= 3) {
          participantInfo += `External Participants: ${externalParticipants.join(', ')}`;
        } else if (externalParticipants.length > 3) {
          participantInfo += `External Participants: ${externalParticipants.length} people (Group Call)`;
        }

        const userPrompt = `Date: ${callDate}
Original Title: ${rec.title}
Participants: ${participantInfo}
Transcript:
${cleanedTranscript}`;

        const aiTitle = await generateTitleWithModel(userPrompt, canonicalId, cleanedTranscript.length);
        if (!aiTitle) {
          results.push({ recordingId: canonicalId, success: false, error: 'Model returned reasoning instead of title after 2 attempts' });
          return;
        }

        const { error: updateError } = await supabase
          .from('recordings')
          .update({
            ai_generated_title: aiTitle,
            ai_title_generated_at: new Date().toISOString(),
          })
          .eq('id', canonicalId)
          .eq('owner_user_id', userId);

        if (updateError) {
          console.error(`Error updating recordings title for ${canonicalId}:`, updateError);
          results.push({ recordingId: canonicalId, success: false, error: updateError.message });
        } else {
          results.push({ recordingId: canonicalId, success: true, originalTitle: rec.title, aiGeneratedTitle: aiTitle });
        }
      } catch (error) {
        console.error(`Error processing canonical ${canonicalId}:`, error);
        results.push({ recordingId: canonicalId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };

    const processRecording = async (recordingId: number) => {
      try {
        // Fetch call data including participant info
        const { data: call, error: callError } = await supabase
          .from('fathom_raw_calls')
          .select('recording_id, canonical_recording_id, title, full_transcript, created_at, recorded_by_name, recorded_by_email, calendar_invitees')
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
          return;
        }

        // Skip if no transcript
        if (!call.full_transcript) {
          console.log(`Call ${recordingId} has no transcript to analyze`);
          results.push({
            recordingId,
            success: false,
            error: 'No transcript available',
          });
          return;
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

        // Generate title with retry — if the model returns chain-of-thought
        // reasoning instead of just a title, bump temperature and try again.
        const MAX_TITLE_LENGTH = 100;
        const MAX_ATTEMPTS = 2;
        let aiTitle = '';
        let totalLatencyMs = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const startMs = Date.now();
          let result;
          const currentPrompt = attempt === 1
            ? userPrompt
            : userPrompt + '\n\nIMPORTANT: Return ONLY the title string. No reasoning, no steps, no explanation. Just the title.';
          const currentTemp = attempt === 1 ? AI_TEMPERATURE : 0.3;

          let resultText: string;
          let inputTokens: number;
          let outputTokens: number;

          try {
            if (useGoogleDirect) {
              // Direct Gemini REST API — no SDK version issues
              const geminiResult = await callGeminiDirect(
                googleApiKey!, GOOGLE_AI_MODEL, SYSTEM_PROMPT, currentPrompt, currentTemp,
              );
              resultText = geminiResult.text;
              inputTokens = geminiResult.inputTokens;
              outputTokens = geminiResult.outputTokens;
            } else {
              // OpenRouter via Vercel AI SDK.
              const openrouter = createOpenRouterProvider(openrouterApiKey!);
              const result = await generateText({
                model: openrouter(OPENROUTER_AI_MODEL),
                system: SYSTEM_PROMPT,
                prompt: currentPrompt,
                temperature: currentTemp,
              });
              resultText = result.text;
              inputTokens = result.usage?.inputTokens ?? estimateTokenCount(SYSTEM_PROMPT + currentPrompt);
              outputTokens = result.usage?.outputTokens ?? estimateTokenCount(result.text);
            }
            await trace?.end(resultText);
          } catch (error) {
            await trace?.end(null, error instanceof Error ? error.message : 'Unknown error');
            throw error;
          }
          const latencyMs = Date.now() - startMs;
          totalLatencyMs += latencyMs;
          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;

          // Clean up the response
          aiTitle = resultText
            .trim()
            .replace(/^["'`]|["'`]$/g, '')
            .replace(/`/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/\n/g, ' ')
            .trim();

          if (aiTitle.length <= MAX_TITLE_LENGTH) {
            if (attempt > 1) console.log(`Retry succeeded for ${recordingId}: "${aiTitle}"`);
            break;
          }

          if (attempt < MAX_ATTEMPTS) {
            console.warn(`Title for ${recordingId} is ${aiTitle.length} chars on attempt ${attempt} — retrying with stronger instruction.`);
          } else {
            // Both attempts returned garbage — skip this recording entirely.
            // The UI will show the recording ID fallback instead of truncated junk.
            console.error(`Title for ${recordingId} still ${aiTitle.length} chars after ${MAX_ATTEMPTS} attempts — skipping (will show ID fallback).`);
            results.push({
              recordingId,
              success: false,
              error: 'Model returned reasoning instead of title after 2 attempts',
            });
            return;
          }
        }
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
          // fathom_raw_calls.ai_generated_title is the source of truth for AI titles.
          // The UI surfaces it via the get_workspace_recordings RPC (LEFT JOIN fathom_raw_calls)
          // and displays it as the subtitle beneath the original call title.
          // We do NOT overwrite recordings.title — that preserves the original call name.
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
    };

    // Process all recordings in parallel — independent LLM calls, no need to serialize.
    // Fathom (BIGINT) and canonical (UUID) recordings run side by side.
    await Promise.all([
      ...idsToProcess.map(processRecording),
      ...uuidsToProcess.map(processCanonicalRecording),
    ]);

    const totalProcessed = idsToProcess.length + uuidsToProcess.length;
    const successCount = results.filter(r => r.success).length;

    // Flush Langfuse traces before response
    await flushLangfuse();

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed,
        successCount,
        failureCount: totalProcessed - successCount,
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
