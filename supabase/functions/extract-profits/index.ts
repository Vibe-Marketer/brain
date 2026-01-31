/**
 * EXTRACT-PROFITS EDGE FUNCTION
 *
 * AI-powered PROFITS framework extraction from call transcripts.
 * Extracts sales psychology insights with clickable citations.
 *
 * PROFITS Framework:
 * - P (Pain): Problems, struggles, pain points
 * - R (Results): Desired outcomes, goals
 * - O (Obstacles): Barriers, blockers
 * - F (Fears): Concerns, worries
 * - I (Identity): Self-description, role, company
 * - T (Triggers): Action motivators
 * - S (Success): Wins, achievements
 *
 * Features:
 * - Uses Vercel AI SDK v5 with OpenRouter provider
 * - Structured output with Zod schemas
 * - Clickable citations linking to transcript moments
 * - Database caching in fathom_calls.profits_framework
 *
 * Endpoints:
 * - POST /functions/v1/extract-profits
 *   Body: { recording_id: number, force_refresh?: boolean }
 *   Returns: { success, profits_framework, cached, extracted_at }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';

// =============================================================================
// TYPES & SCHEMAS
// =============================================================================

// PROFITS letter type
type PROFITSLetter = 'P' | 'R' | 'O' | 'F' | 'I' | 'T' | 'S';

// PROFITS section titles
const PROFITS_TITLES: Record<PROFITSLetter, string> = {
  P: 'Pain',
  R: 'Results',
  O: 'Obstacles',
  F: 'Fears',
  I: 'Identity',
  T: 'Triggers',
  S: 'Success',
};

// Request schema
const RequestSchema = z.object({
  recording_id: z.number().int().positive('recording_id must be a positive integer'),
  force_refresh: z.boolean().optional().default(false),
});

// Citation structure for linking to transcript moments
interface PROFITSCitation {
  transcript_id: string;
  timestamp: string | null;
}

// Finding structure - each insight extracted
interface PROFITSFinding {
  text: string;           // Summary of the finding
  quote: string;          // Exact quote from transcript
  citation: PROFITSCitation;
  confidence: number;     // 0-1 confidence score
}

// Section structure - one for each letter in PROFITS
interface PROFITSSection {
  letter: PROFITSLetter;
  title: string;
  findings: PROFITSFinding[];
}

// Full PROFITS report
interface PROFITSReport {
  recording_id: number;
  sections: PROFITSSection[];
  generated_at: string;
  model_used: string;
}

// Transcript segment for processing
interface TranscriptSegment {
  id: string;
  text: string;
  speaker: string | null;
  timestamp: string | null;
}

// =============================================================================
// OPENROUTER CONFIGURATION
// =============================================================================

function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault PROFITS Extraction',
    },
  });
}

// =============================================================================
// PROFITS EXTRACTION LOGIC
// =============================================================================

const PROFITS_SYSTEM_PROMPT = `You are a sales psychology analyst extracting PROFITS framework insights from meeting transcripts.

PROFITS Framework:
- P (Pain): What struggles, problems, or pain points does the prospect/customer describe?
- R (Results): What outcomes, goals, or desired results do they express wanting?
- O (Obstacles): What barriers or blockers are preventing their progress?
- F (Fears): What concerns, worries, or fears are holding them back?
- I (Identity): How do they describe themselves, their role, their company, or their situation?
- T (Triggers): What motivated them to take action, reach out, or consider change?
- S (Success): What wins, achievements, or positive outcomes have they mentioned?

For EACH finding, you MUST include:
1. "text": A brief 1-2 sentence summary of the insight
2. "quote": The EXACT words from the transcript (verbatim, no paraphrasing)
3. "segment_index": The segment number where this quote appears (from the provided [SEG N] markers)
4. "confidence": A score from 0 to 1 indicating how confident you are this is a genuine example

IMPORTANT RULES:
- Only include findings where you found clear, explicit examples in the transcript
- Quotes must be VERBATIM from the transcript - do not paraphrase or modify
- If no examples found for a category, return an empty array for that section
- Focus on quality over quantity - 2-4 strong findings per category is ideal
- Maximum 7 findings per category

Output VALID JSON in this exact format:
{
  "sections": [
    {
      "letter": "P",
      "findings": [
        {
          "text": "Summary of the pain point",
          "quote": "Exact quote from transcript",
          "segment_index": 5,
          "confidence": 0.85
        }
      ]
    },
    { "letter": "R", "findings": [] },
    { "letter": "O", "findings": [] },
    { "letter": "F", "findings": [] },
    { "letter": "I", "findings": [] },
    { "letter": "T", "findings": [] },
    { "letter": "S", "findings": [] }
  ]
}`;

/**
 * Format transcript segments with markers for the AI to reference
 */
function formatTranscriptForExtraction(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, index) => {
      const speaker = seg.speaker ? `${seg.speaker}: ` : '';
      return `[SEG ${index}] ${speaker}${seg.text}`;
    })
    .join('\n\n');
}

/**
 * Build the lookup map from segment index to transcript info
 */
function buildSegmentLookup(segments: TranscriptSegment[]): Map<number, TranscriptSegment> {
  const lookup = new Map<number, TranscriptSegment>();
  segments.forEach((seg, index) => {
    lookup.set(index, seg);
  });
  return lookup;
}

/**
 * Extract PROFITS insights from transcript using AI
 */
async function extractPROFITS(
  segments: TranscriptSegment[],
  callTitle: string,
  openrouter: ReturnType<typeof createOpenRouter>,
  modelId: string
): Promise<{ sections: PROFITSSection[]; model_used: string }> {
  // Format transcript with segment markers
  const formattedTranscript = formatTranscriptForExtraction(segments);
  const segmentLookup = buildSegmentLookup(segments);

  // Limit transcript size if needed (handle long transcripts)
  const MAX_CHARS = 40000;
  const truncatedTranscript = formattedTranscript.length > MAX_CHARS
    ? formattedTranscript.substring(0, MAX_CHARS) + '\n\n[Transcript truncated...]'
    : formattedTranscript;

  const result = await generateText({
    model: openrouter(modelId),
    system: PROFITS_SYSTEM_PROMPT,
    prompt: `Call Title: ${callTitle || 'Unknown Call'}

Transcript (with segment markers):
${truncatedTranscript}

Extract PROFITS framework insights from this transcript. Return valid JSON.`,
    maxTokens: 4000,
  });

  // Parse the AI response
  let parsed: { sections: Array<{ letter: string; findings: Array<{ text: string; quote: string; segment_index: number; confidence: number }> }> };
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = result.text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    parsed = JSON.parse(jsonStr.trim());
  } catch (e) {
    console.error('Failed to parse AI response:', result.text);
    throw new Error('Failed to parse PROFITS extraction response');
  }

  // Transform to our structure with proper citations
  const sections: PROFITSSection[] = (['P', 'R', 'O', 'F', 'I', 'T', 'S'] as PROFITSLetter[]).map((letter) => {
    const aiSection = parsed.sections?.find(s => s.letter === letter);
    const findings: PROFITSFinding[] = (aiSection?.findings || []).map(f => {
      // Look up the segment to get transcript_id and timestamp
      const segment = segmentLookup.get(f.segment_index);
      
      return {
        text: f.text,
        quote: f.quote,
        citation: {
          transcript_id: segment?.id || '',
          timestamp: segment?.timestamp || null,
        },
        confidence: Math.max(0, Math.min(1, f.confidence)), // Clamp to 0-1
      };
    });

    return {
      letter,
      title: PROFITS_TITLES[letter],
      findings,
    };
  });

  return {
    sections,
    model_used: modelId,
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment setup
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

    // Authentication
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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recording_id, force_refresh } = validation.data;

    // Fetch the call - verify user ownership
    const { data: call, error: callError } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, profits_framework')
      .eq('recording_id', recording_id)
      .eq('user_id', user.id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: 'Recording not found or unauthorized' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we already have PROFITS data (unless force_refresh)
    if (!force_refresh && call.profits_framework) {
      return new Response(
        JSON.stringify({
          success: true,
          recording_id,
          profits_framework: call.profits_framework as PROFITSReport,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transcript segments
    const { data: transcripts, error: transcriptError } = await supabase
      .from('fathom_transcripts')
      .select('id, text, speaker_name, timestamp, edited_text, edited_speaker_name')
      .eq('recording_id', recording_id)
      .eq('user_id', user.id)
      .is('is_deleted', false)
      .order('timestamp', { ascending: true, nullsFirst: true });

    if (transcriptError) {
      console.error('Failed to fetch transcripts:', transcriptError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transcript data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcripts || transcripts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transcript available for this recording' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform to segment format (prefer edited versions if available)
    const segments: TranscriptSegment[] = transcripts.map(t => ({
      id: t.id,
      text: t.edited_text || t.text,
      speaker: t.edited_speaker_name || t.speaker_name,
      timestamp: t.timestamp,
    }));

    // Extract PROFITS using AI
    const modelId = 'anthropic/claude-3-haiku-20240307';
    const openrouter = createOpenRouterProvider(openrouterApiKey);
    const { sections, model_used } = await extractPROFITS(
      segments,
      call.title || '',
      openrouter,
      modelId
    );

    // Build the full report
    const profitsReport: PROFITSReport = {
      recording_id,
      sections,
      generated_at: new Date().toISOString(),
      model_used,
    };

    // Store in database
    const { error: updateError } = await supabase
      .from('fathom_calls')
      .update({
        profits_framework: profitsReport,
      })
      .eq('recording_id', recording_id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to store PROFITS report:', updateError);
      // Still return the report even if storage failed
    }

    // Count findings for logging
    const totalFindings = sections.reduce((sum, s) => sum + s.findings.length, 0);
    console.log(`Extracted ${totalFindings} PROFITS findings for recording ${recording_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        profits_framework: profitsReport,
        cached: false,
        extracted_at: profitsReport.generated_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract-profits error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
