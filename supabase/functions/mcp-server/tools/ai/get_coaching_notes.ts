import { enforceMcpAiUsage } from '../../../_shared/track-ai-usage-inline.ts';
import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

type CoachingNotes = {
  strengths: string[];
  improvements: string[];
  specific_examples: Array<{ topic: string; observation: string; suggestion: string }>;
};

export const getCoachingNotesTool: ToolModule = {
  definition: { name: 'get_coaching_notes' },
  category: 'ai',
  async handler({ id, params, supabase, mcpToken, corsHeaders, fetchOrgWorkspaceIds }) {
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

    if (mcpToken.scope === 'workspace') {
      const { data: access } = await supabase
        .from('workspace_entries')
        .select('recording_id')
        .eq('recording_id', recordingId)
        .eq('workspace_id', mcpToken.workspace_id!)
        .maybeSingle();
      if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
    } else {
      const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
      if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
      const { data: access } = await supabase
        .from('workspace_entries')
        .select('recording_id')
        .eq('recording_id', recordingId)
        .in('workspace_id', orgWsIds)
        .maybeSingle();
      if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
    }

    const { data: recording, error: recError } = await supabase
      .from('recordings')
      .select('id, title, full_transcript, coaching_cache')
      .eq('id', recordingId)
      .maybeSingle();

    if (recError || !recording) {
      return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
    }

    const formatCoaching = (data: CoachingNotes, source: 'cached' | 'analyzed') => {
      const lines = [`# Coaching Notes: ${recording.title || 'Untitled'} (${source})`];

      if (data.strengths.length > 0) {
        lines.push('', '## Strengths');
        data.strengths.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }

      if (data.improvements.length > 0) {
        lines.push('', '## Areas for Improvement');
        data.improvements.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }

      if (data.specific_examples.length > 0) {
        lines.push('', '## Specific Examples');
        data.specific_examples.forEach((ex, i) => {
          lines.push(`${i + 1}. **${ex.topic}**`);
          lines.push(`   - Observation: ${ex.observation}`);
          lines.push(`   - Suggestion: ${ex.suggestion}`);
        });
      }

      if (
        data.strengths.length === 0 &&
        data.improvements.length === 0 &&
        data.specific_examples.length === 0
      ) {
        lines.push('', 'No coaching notes generated for this recording.');
      }

      return lines.join('\n');
    };

    const cached = recording.coaching_cache as CoachingNotes | null;
    if (
      cached &&
      typeof cached === 'object' &&
      Array.isArray(cached.strengths) &&
      Array.isArray(cached.improvements) &&
      Array.isArray(cached.specific_examples)
    ) {
      return mcpOk(id, formatCoaching(cached, 'cached'));
    }

    const transcript = recording.full_transcript || '';
    if (!transcript.trim()) {
      return mcpError(id, -32602, 'No transcript available for this recording', corsHeaders);
    }

    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterApiKey) {
      return mcpError(id, -32603, 'AI provider not configured', corsHeaders);
    }

    const gate = await enforceMcpAiUsage({
      supabase,
      userId: mcpToken.user_id,
      orgId: mcpToken.org_id,
      actionType: 'mcp_coaching',
      recordingId,
    });
    if (!gate.allowed) {
      return mcpError(id, -32001, gate.reason, corsHeaders);
    }

    const limitedTranscript =
      transcript.length > 15000
        ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for coaching analysis...]'
        : transcript;

    const [{ createOpenRouter }, { generateObject }, { z }] = await Promise.all([
      import('https://esm.sh/@openrouter/ai-sdk-provider@1.2.8'),
      import('https://esm.sh/ai@5.0.102'),
      import('https://esm.sh/zod@3.23.8'),
    ]);

    const CoachingSchema = z.object({
      strengths: z
        .array(z.string())
        .describe(
          'What the salesperson / lead speaker did well. 2-5 items. Each item is one sentence, factual, references the conversation.',
        ),
      improvements: z
        .array(z.string())
        .describe(
          'Areas the salesperson / lead speaker could improve. 2-5 items. Each item is one sentence, actionable, references the conversation.',
        ),
      specific_examples: z
        .array(
          z.object({
            topic: z.string().describe('Short label for the topic / situation (e.g., "Pricing objection", "Discovery question").'),
            observation: z.string().describe('What happened in the call regarding this topic. One sentence with a brief paraphrase.'),
            suggestion: z.string().describe('Concrete suggestion for the next call. One sentence, imperative, actionable.'),
          }),
        )
        .describe('2-5 specific moments worth coaching on. Pull from real moments in the transcript; do not invent.'),
    });

    const openrouter = createOpenRouter({
      apiKey: openrouterApiKey,
      headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
    });

    const prompt = `Generate sales coaching notes for this call transcript.

Meeting Title: ${recording.title || 'Unknown'}

Required output:
1. Strengths — 2 to 5 things the salesperson / lead speaker did well. Be specific and reference actual moments.
2. Areas for Improvement — 2 to 5 actionable things the salesperson could do differently next time.
3. Specific Examples — 2 to 5 concrete moments from the call worth coaching on, each with a topic label, what was observed, and a suggestion for the next call.

Be factual. Reference actual content from the transcript. Do not invent moments. If the call doesn't appear to be sales-oriented (internal meeting, podcast, etc.), still produce general communication coaching notes — every conversation has communication patterns worth noting.

Transcript:
${limitedTranscript}`;

    let llmResult: CoachingNotes;
    try {
      const result = await generateObject({
        model: openrouter('openai/gpt-5-nano'),
        schema: CoachingSchema,
        prompt,
      });
      llmResult = result.object;
    } catch (err) {
      console.error('get_coaching_notes: LLM call failed:', err);
      return mcpError(
        id,
        -32603,
        'Failed to generate coaching notes for this recording',
        corsHeaders,
      );
    }

    const { error: cacheError } = await supabase
      .from('recordings')
      .update({ coaching_cache: llmResult })
      .eq('id', recordingId);
    if (cacheError) {
      console.error('get_coaching_notes: cache write failed:', cacheError);
    }

    return mcpOk(id, formatCoaching(llmResult, 'analyzed'));
  },
};
