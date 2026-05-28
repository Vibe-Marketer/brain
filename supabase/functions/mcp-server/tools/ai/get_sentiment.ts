import { enforceMcpAiUsage } from '../../../_shared/track-ai-usage-inline.ts';
import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

type SentimentResult = {
  overall: 'positive' | 'neutral' | 'negative' | 'mixed';
  talk_ratio: Array<{ speaker_name: string; percentage: number }>;
  key_moments: Array<{ timestamp: string; sentiment: string; snippet: string }>;
};
type CreateOpenRouter = (config: {
  apiKey: string;
  headers: Record<string, string>;
}) => (modelId: string) => unknown;
type GenerateObject<T> = (options: {
  model: unknown;
  schema: unknown;
  prompt: string;
}) => Promise<{ object: T }>;

export const getSentimentTool: ToolModule = {
  definition: { name: 'get_sentiment' },
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
      .select('id, title, full_transcript, sentiment_cache')
      .eq('id', recordingId)
      .maybeSingle();

    if (recError || !recording) {
      return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
    }

    const formatSentiment = (data: SentimentResult, source: 'cached' | 'analyzed') => {
      const lines = [`# Sentiment: ${recording.title || 'Untitled'} (${source})`];
      lines.push('', `**Overall:** ${data.overall}`);

      if (data.talk_ratio.length > 0) {
        lines.push('', '## Talk Ratio');
        data.talk_ratio.forEach((r) => {
          lines.push(`- ${r.speaker_name}: ${r.percentage}%`);
        });
      }

      if (data.key_moments.length > 0) {
        lines.push('', '## Key Moments');
        data.key_moments.forEach((m, i) => {
          lines.push(`${i + 1}. [${m.timestamp}] (${m.sentiment}) "${m.snippet}"`);
        });
      }

      return lines.join('\n');
    };

    const cached = recording.sentiment_cache as SentimentResult | null;
    if (
      cached &&
      typeof cached === 'object' &&
      typeof cached.overall === 'string' &&
      ['positive', 'neutral', 'negative', 'mixed'].includes(cached.overall) &&
      Array.isArray(cached.talk_ratio) &&
      Array.isArray(cached.key_moments)
    ) {
      return mcpOk(id, formatSentiment(cached, 'cached'));
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
      actionType: 'mcp_sentiment',
      recordingId,
    });
    if (!gate.allowed) {
      return mcpError(id, -32001, gate.reason, corsHeaders);
    }

    const limitedTranscript =
      transcript.length > 15000
        ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for sentiment analysis...]'
        : transcript;

    const [openRouterModule, aiModule, zodModule] = await Promise.all([
      import('https://esm.sh/@openrouter/ai-sdk-provider@2.9.0'),
      import('https://esm.sh/ai@6.0.66'),
      import('https://esm.sh/zod@3.25.76'),
    ]);
    const createOpenRouter = openRouterModule.createOpenRouter as CreateOpenRouter;
    const generateObject = aiModule.generateObject as GenerateObject<SentimentResult>;
    const z = zodModule.z;

    const SentimentSchema = z.object({
      overall: z
        .enum(['positive', 'neutral', 'negative', 'mixed'])
        .describe('Overall tone of the conversation across all speakers.'),
      talk_ratio: z
        .array(
          z.object({
            speaker_name: z.string().describe('Speaker name as it appears in the transcript.'),
            percentage: z
              .number()
              .min(0)
              .max(100)
              .describe('Approximate share of speaking time, 0-100. All percentages should sum to ~100.'),
          }),
        )
        .describe('Per-speaker share of speaking time (best-effort estimate from transcript content).'),
      key_moments: z
        .array(
          z.object({
            timestamp: z
              .string()
              .describe('Approximate timestamp from the transcript in MM:SS or HH:MM:SS form, or empty string if not present.'),
            sentiment: z.string().describe('Short sentiment label for this moment (e.g., "tense", "celebratory", "frustrated").'),
            snippet: z.string().describe('Direct quote (5-30 words) from the transcript at this moment.'),
          }),
        )
        .describe('2-5 notable moments where sentiment shifts or peaks.'),
    });

    const openrouter = createOpenRouter({
      apiKey: openrouterApiKey,
      headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
    });

    const prompt = `Analyze the sentiment of this call transcript.

Meeting Title: ${recording.title || 'Unknown'}

Required output:
1. Overall sentiment across the conversation: positive | neutral | negative | mixed
2. Per-speaker talk ratio (estimate from text length; total ~100%)
3. 2-5 key moments where sentiment is notable, with approximate timestamps if present in the transcript

Be factual. Use direct quotes for snippets. Do not invent moments not in the transcript.

Transcript:
${limitedTranscript}`;

    let llmResult: SentimentResult;
    try {
      const result = await generateObject({
        model: openrouter('openai/gpt-5-nano'),
        schema: SentimentSchema,
        prompt,
      });
      llmResult = result.object;
    } catch (err) {
      console.error('get_sentiment: LLM call failed:', err);
      return mcpError(id, -32603, 'Failed to analyze sentiment for this recording', corsHeaders);
    }

    const { error: cacheError } = await supabase
      .from('recordings')
      .update({ sentiment_cache: llmResult })
      .eq('id', recordingId);
    if (cacheError) {
      console.error('get_sentiment: cache write failed:', cacheError);
    }

    return mcpOk(id, formatSentiment(llmResult, 'analyzed'));
  },
};
