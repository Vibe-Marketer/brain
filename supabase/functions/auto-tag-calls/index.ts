import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { startTrace, flushLangfuse } from '../_shared/langfuse.ts';

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

interface AutoTagRequest {
  recordingIds?: number[];
  user_id?: string;            // For internal service calls (bypasses JWT auth)
  organization_id?: string;    // Required org scope — prevents cross-org data access
  auto_discover?: boolean;     // Find all calls without auto_tags
  limit?: number;              // Max calls when auto_discover is true
  respectPreference?: boolean; // When true, skip if user has autoProcessingTagging=false
}

// Approved tag list - MUST use only these tags
const APPROVED_TAGS = [
  'TEAM',           // team/founder meeting
  'COACH (2+)',     // group coaching / paid
  'COACH (1:1)',    // one to one coaching
  'WEBINAR (2+)',   // Large group events-webinars
  'SALES (1:1)',    // one to one sales calls
  'EXTERNAL',       // podcasts, communities, collaborations
  'DISCOVERY',      // pre-sales / triage / setter
  'ONBOARDING',     // actual platform onboarding calls
  'REFUND',         // refund / retention calls/requests
  'FREE',           // Free community calls / group calls
  'EDUCATION',      // Personal Edu - Coaching I attend
  'PRODUCT',        // PRODUCT Demos
  'SUPPORT',        // customer support, tech issues, training
  'REVIEW',         // testimonials, reviews, interviews, feedback
  'STRATEGY',       // internal mission, vision, and strategy
] as const;

const TagSchema = z.object({
  tag: z.enum(APPROVED_TAGS).describe('The SINGLE most appropriate tag from the approved list'),
  confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
  reasoning: z.string().describe('Detailed explanation of why this specific tag was chosen'),
});

interface TagPreference {
  tag: string;
  title_keywords: string[] | null;
  title_patterns: string[] | null;
  attendee_emails: string[] | null;
  attendee_domains: string[] | null;
  attendee_names: string[] | null;
  min_attendees: number | null;
  max_attendees: number | null;
  content_keywords: string[] | null;
  priority: number;
  notes: string | null;
}

interface HistoricalPattern {
  tag: string;
  similar_titles: string[];
  common_attendees: string[];
  typical_attendee_count: number;
}

async function getUserTagPreferences(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  _organizationId: string
): Promise<TagPreference[]> {
  // NOTE: tag_preferences table lacks organization_id column.
  // Currently scoped by user_id only. When org-level tag preferences are needed,
  // add organization_id to tag_preferences and filter here.
  // TODO: migration to add organization_id to tag_preferences (issue #173)
  const { data, error } = await supabase
    .from('tag_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Error fetching tag preferences:', error);
    return [];
  }

  return data || [];
}

async function getHistoricalPatterns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  _currentTitle: string,
  organizationId: string
): Promise<HistoricalPattern[]> {
  // Get historical calls with tags to learn patterns.
  // fathom_raw_calls lacks organization_id, so we scope via recordings join.
  // recordings.legacy_recording_id links to fathom_raw_calls.recording_id.
  const { data: orgRecordingIds, error: orgError } = await supabase
    .from('recordings')
    .select('legacy_recording_id')
    .eq('organization_id', organizationId)
    .not('legacy_recording_id', 'is', null)
    .limit(200);

  if (orgError || !orgRecordingIds || orgRecordingIds.length === 0) {
    console.log('No org recordings found for historical patterns');
    return [];
  }

  const legacyIds = orgRecordingIds
    .map((r: { legacy_recording_id: number | null }) => r.legacy_recording_id)
    .filter(Boolean);

  if (legacyIds.length === 0) {
    console.log('No legacy recording IDs found for historical patterns');
    return [];
  }

  const { data, error } = await supabase
    .from('fathom_raw_calls')
    .select('auto_tags, title, calendar_invitees')
    .eq('user_id', userId)
    .in('recording_id', legacyIds)
    .not('auto_tags', 'is', null)
    .limit(100);

  if (error || !data) {
    console.log('No historical data found');
    return [];
  }

  // Group by tag
  const patternsByTag: Record<string, HistoricalPattern> = {};

  for (const call of data) {
    const tags = call.auto_tags || [];
    if (tags.length === 0) continue;

    const tag = tags[0]; // Primary tag
    if (!patternsByTag[tag]) {
      patternsByTag[tag] = {
        tag,
        similar_titles: [],
        common_attendees: [],
        typical_attendee_count: 0,
      };
    }

    patternsByTag[tag].similar_titles.push(call.title);

    if (call.calendar_invitees && Array.isArray(call.calendar_invitees)) {
      const attendeeCount = call.calendar_invitees.length;
      patternsByTag[tag].typical_attendee_count =
        (patternsByTag[tag].typical_attendee_count + attendeeCount) / 2;

      for (const invitee of call.calendar_invitees) {
        if (invitee.email) {
          patternsByTag[tag].common_attendees.push(invitee.email);
        }
      }
    }
  }

  return Object.values(patternsByTag);
}

function buildPreferencesContext(preferences: TagPreference[]): string {
  if (preferences.length === 0) {
    return 'No user-defined preferences available.';
  }

  let context = 'USER-DEFINED TAG PREFERENCES (follow these rules FIRST):\n\n';

  for (const pref of preferences) {
    context += `${pref.tag} (Priority: ${pref.priority}):\n`;
    if (pref.notes) context += `  - ${pref.notes}\n`;
    if (pref.title_keywords && pref.title_keywords.length > 0) {
      context += `  - Title keywords: ${pref.title_keywords.join(', ')}\n`;
    }
    if (pref.attendee_emails && pref.attendee_emails.length > 0) {
      context += `  - Specific attendees: ${pref.attendee_emails.join(', ')}\n`;
    }
    if (pref.attendee_domains && pref.attendee_domains.length > 0) {
      context += `  - Attendee domains: ${pref.attendee_domains.join(', ')}\n`;
    }
    if (pref.min_attendees) {
      context += `  - Minimum attendees: ${pref.min_attendees}\n`;
    }
    if (pref.max_attendees) {
      context += `  - Maximum attendees: ${pref.max_attendees}\n`;
    }
    if (pref.content_keywords && pref.content_keywords.length > 0) {
      context += `  - Content keywords: ${pref.content_keywords.join(', ')}\n`;
    }
    context += '\n';
  }

  return context;
}

function buildHistoricalContext(patterns: HistoricalPattern[]): string {
  if (patterns.length === 0) {
    return 'No historical patterns available.';
  }

  let context = 'HISTORICAL PATTERNS (learn from past tagging):\n\n';

  for (const pattern of patterns) {
    context += `${pattern.tag}:\n`;
    context += `  - Typical attendee count: ${Math.round(pattern.typical_attendee_count)}\n`;
    if (pattern.similar_titles.length > 0) {
      const uniqueTitles = [...new Set(pattern.similar_titles)].slice(0, 5);
      context += `  - Similar past titles: ${uniqueTitles.join('; ')}\n`;
    }
    if (pattern.common_attendees.length > 0) {
      const uniqueAttendees = [...new Set(pattern.common_attendees)].slice(0, 5);
      context += `  - Common attendees: ${uniqueAttendees.join(', ')}\n`;
    }
    context += '\n';
  }

  return context;
}

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
    const body: AutoTagRequest = await req.json();
    const { recordingIds: bodyRecordingIds, user_id: internalUserId, organization_id: bodyOrgId, auto_discover, limit = 50, respectPreference = false } = body;

    let userId: string;

    // Check for internal service call (from webhook or other Edge Functions)
    if (internalUserId) {
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

    // -----------------------------------------------------------------------
    // Resolve organization_id and verify user membership
    // -----------------------------------------------------------------------
    let organizationId: string;

    if (bodyOrgId) {
      // Caller provided an explicit org — verify membership
      const { data: membership, error: memberError } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', bodyOrgId)
        .maybeSingle();

      if (memberError || !membership) {
        return new Response(
          JSON.stringify({ error: 'Not a member of this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      organizationId = bodyOrgId;
    } else {
      // No org provided — fall back to user's personal org
      const { data: personalOrg, error: orgError } = await supabase
        .from('organization_memberships')
        .select('organizations!inner(id, type)')
        .eq('user_id', userId)
        .eq('organizations.type', 'personal')
        .maybeSingle();

      if (orgError || !personalOrg) {
        return new Response(
          JSON.stringify({ error: 'Could not resolve organization for user. Pass organization_id in request body.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // deno-lint-ignore no-explicit-any
      organizationId = (personalOrg as any).organizations.id;
    }

    console.log(`Auto-tag scoped to organization: ${organizationId}`);

    // Check user preference when called from automated pipeline
    if (respectPreference) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('auto_processing_preferences')
        .eq('user_id', userId)
        .maybeSingle();

      const prefs = profile?.auto_processing_preferences as { autoProcessingTagging?: boolean } | null;
      if (prefs?.autoProcessingTagging !== true) {
        console.log(`Auto-tagging disabled for user ${userId}, skipping`);
        return new Response(
          JSON.stringify({ success: true, message: 'Auto-tagging disabled by user preference', totalProcessed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let recordingIds: number[];

    if (auto_discover) {
      // Find all calls without auto_tags, scoped to org via recordings join.
      // fathom_raw_calls lacks organization_id, so we first get the org's
      // legacy_recording_ids from the recordings table, then filter.
      console.log(`Auto-discovering untagged calls for user ${userId} in org ${organizationId} (limit: ${limit})`);

      const { data: orgRecordings, error: orgRecError } = await supabase
        .from('recordings')
        .select('legacy_recording_id')
        .eq('organization_id', organizationId)
        .not('legacy_recording_id', 'is', null);

      if (orgRecError) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch org recordings: ${orgRecError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const orgLegacyIds = (orgRecordings || [])
        .map((r: { legacy_recording_id: number | null }) => r.legacy_recording_id)
        .filter(Boolean);

      if (orgLegacyIds.length === 0) {
        recordingIds = [];
      } else {
        const { data: untaggedCalls, error: discoverError } = await supabase
          .from('fathom_raw_calls')
          .select('recording_id')
          .eq('user_id', userId)
          .in('recording_id', orgLegacyIds)
          .is('auto_tags', null)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (discoverError) {
          return new Response(
            JSON.stringify({ error: `Failed to discover calls: ${discoverError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        recordingIds = (untaggedCalls || []).map(c => c.recording_id);
      }
      console.log(`Found ${recordingIds.length} calls needing auto-tagging`);
    } else if (bodyRecordingIds && bodyRecordingIds.length > 0) {
      recordingIds = bodyRecordingIds;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either recordingIds or auto_discover=true is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recordingIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No calls to process', totalProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auto-tagging ${recordingIds.length} calls for user ${userId}`);

    // Load user preferences and historical patterns ONCE (org-scoped)
    const [preferences, historicalPatterns] = await Promise.all([
      getUserTagPreferences(supabase, userId, organizationId),
      getHistoricalPatterns(supabase, userId, '', organizationId),
    ]);

    const preferencesContext = buildPreferencesContext(preferences);
    const historicalContext = buildHistoricalContext(historicalPatterns);

    const results = [];
    const openrouter = createOpenRouterProvider(openrouterApiKey);

    for (const recordingId of recordingIds) {
      try {
        // Fetch call data
        const { data: call, error: callError } = await supabase
          .from('fathom_raw_calls')
          .select('recording_id, title, full_transcript, summary, calendar_invitees')
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

        // Skip if no content
        if (!call.full_transcript && !call.summary) {
          console.log(`Call ${recordingId} has no content to analyze`);
          results.push({
            recordingId,
            success: false,
            error: 'No transcript or summary available',
          });
          continue;
        }

        // Extract attendee information
        const attendeeCount = call.calendar_invitees?.length || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attendeeEmails = call.calendar_invitees?.map((inv: any) => inv.email).filter(Boolean) || [];
        const _attendeeDomains = attendeeEmails.map((email: string) => email.split('@')[1]);

        // Prepare content for AI analysis
        const callInfo = [
          `Title: ${call.title}`,
          `Attendee count: ${attendeeCount}`,
          attendeeEmails.length > 0 ? `Attendees: ${attendeeEmails.join(', ')}` : '',
          call.summary ? `Summary: ${call.summary}` : '',
          call.full_transcript ? `Transcript excerpt: ${call.full_transcript.substring(0, 2000)}` : '',
        ].filter(Boolean).join('\n\n');

        // Generate tag using OpenRouter via AI SDK with preferences and history
        const tagPrompt = `Analyze this meeting call and assign the SINGLE most appropriate tag.

${preferencesContext}

${historicalContext}

APPROVED TAG LIST (you MUST choose ONE from these):
1. TEAM - team/founder meeting (internal team discussions, planning, updates)
2. COACH (2+) - group coaching / paid (group coaching sessions with multiple participants)
3. COACH (1:1) - one to one coaching (individual coaching sessions)
4. WEBINAR (2+) - Large group events-webinars (presentations, workshops, large audiences)
5. SALES (1:1) - one to one sales calls (individual sales conversations)
6. EXTERNAL - podcasts, communities, collaborations (external partnerships, media appearances)
7. DISCOVERY - pre-sales / triage / setter (qualification calls, initial consultations)
8. ONBOARDING - actual platform onboarding calls (helping new customers get started)
9. REFUND - refund / retention calls/requests (handling cancellations, refunds, retention)
10. FREE - Free community calls / group calls in our community (unpaid community sessions)
11. EDUCATION - Personal Edu - Coaching I attend (calls where YOU are the learner/attendee)
12. PRODUCT - PRODUCT Demos (product demonstrations, feature showcases)
13. SUPPORT - customer support, tech issues, training (troubleshooting, technical assistance)
14. REVIEW - testimonials, reviews, interviews, and feedback (gathering feedback, testimonials)
15. STRATEGY - internal mission, vision, and strategy (high-level strategic planning)

TAGGING PRIORITY:
1. FIRST: Check user-defined preferences above (title keywords, attendee rules, etc.)
2. SECOND: Look for similar patterns in historical data
3. THIRD: Analyze call content, title, and attendees
4. Select the SINGLE BEST tag (not multiple)
5. Use (1:1) vs (2+) based on actual attendee count

Current Call Information:
${callInfo}

Select the ONE most appropriate tag from the approved list.`;

        // Start Langfuse trace
        const trace = startTrace({
          name: 'auto-tag-calls',
          userId,
          model: 'openai/gpt-5-nano',
          input: { prompt: tagPrompt.substring(0, 500) + '...' },
          metadata: { recordingId, attendeeCount },
        });

        let result;
        try {
          result = await generateObject({
            model: openrouter('openai/gpt-5-nano'),
            schema: TagSchema,
            prompt: tagPrompt,
          });
          await trace?.end(result.object);
        } catch (error) {
          await trace?.end(null, error instanceof Error ? error.message : 'Unknown error');
          throw error;
        }

        const selectedTag = result.object.tag;
        console.log(`Generated tag for ${recordingId}: ${selectedTag} (${result.object.confidence}% confidence) - ${result.object.reasoning}`);

        // Update database with SINGLE tag in array format (for backward compatibility)
        const { error: updateError } = await supabase
          .from('fathom_raw_calls')
          .update({
            auto_tags: [selectedTag], // Single tag in array
            auto_tags_generated_at: new Date().toISOString(),
          })
          .eq('recording_id', recordingId)
          .eq('user_id', userId);

        if (updateError) {
          console.error(`Error updating tag for ${recordingId}:`, updateError);
          results.push({
            recordingId,
            success: false,
            error: updateError.message,
          });
        } else {
          results.push({
            recordingId,
            success: true,
            tag: selectedTag,
            confidence: result.object.confidence,
            reasoning: result.object.reasoning,
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
        totalProcessed: recordingIds.length,
        successCount,
        failureCount: recordingIds.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auto-tag error:', error);
    await flushLangfuse();
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
