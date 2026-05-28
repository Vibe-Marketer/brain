import { enforceMcpAiUsage } from '../../../_shared/track-ai-usage-inline.ts';
import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

type ActionItem = { owner: string | null; action: string; due_date: string | null };
type CreateOpenRouter = (config: {
  apiKey: string;
  headers: Record<string, string>;
}) => (modelId: string) => unknown;
type GenerateObject<T> = (options: {
  model: unknown;
  schema: unknown;
  prompt: string;
}) => Promise<{ object: T }>;

export const extractActionItemsTool: ToolModule = {
  definition: { name: 'extract_action_items' },
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
      .select('id, title, full_transcript, source_metadata, action_items_cache')
      .eq('id', recordingId)
      .maybeSingle();

    if (recError || !recording) {
      return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
    }

    const meta = recording.source_metadata as Record<string, unknown> | null;
    const sourceItems = meta?.action_items as string[] | undefined;
    if (sourceItems && Array.isArray(sourceItems) && sourceItems.length > 0) {
      const sourceName = typeof meta?.source_app === 'string' ? meta.source_app : 'source';
      const lines = [`# Action Items: ${recording.title || 'Untitled'} (source: ${sourceName})`];
      sourceItems.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      return mcpOk(id, lines.join('\n'));
    }

    const cached = recording.action_items_cache as { items?: ActionItem[] } | null;
    if (cached && Array.isArray(cached.items)) {
      const lines = [`# Action Items: ${recording.title || 'Untitled'} (cached)`];
      if (cached.items.length === 0) {
        lines.push('', 'No action items found in this transcript.');
      } else {
        cached.items.forEach((it, i) => {
          const owner = it.owner ? `${it.owner}: ` : '';
          const due = it.due_date ? ` (due ${it.due_date})` : '';
          lines.push(`${i + 1}. ${owner}${it.action}${due}`);
        });
      }
      return mcpOk(id, lines.join('\n'));
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
      actionType: 'mcp_action_items',
      recordingId,
    });
    if (!gate.allowed) {
      return mcpError(id, -32001, gate.reason, corsHeaders);
    }

    const limitedTranscript =
      transcript.length > 15000
        ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for extraction...]'
        : transcript;

    const [openRouterModule, aiModule, zodModule] = await Promise.all([
      import('https://esm.sh/@openrouter/ai-sdk-provider@2.9.0'),
      import('https://esm.sh/ai@6.0.66'),
      import('https://esm.sh/zod@3.25.76'),
    ]);
    const createOpenRouter = openRouterModule.createOpenRouter as CreateOpenRouter;
    const generateObject = aiModule.generateObject as GenerateObject<{ items: ActionItem[] }>;
    const z = zodModule.z;

    const ActionItemsSchema = z.object({
      items: z.array(
        z.object({
          owner: z
            .string()
            .nullable()
            .describe(
              'Person responsible — speaker name from the transcript when explicit, otherwise null.',
            ),
          action: z.string().describe('What needs to be done — concise, imperative, one sentence.'),
          due_date: z
            .string()
            .nullable()
            .describe(
              'Due date in ISO 8601 format (YYYY-MM-DD) when the transcript mentions a specific date or relative date that resolves to one; otherwise null.',
            ),
        }),
      ),
    });

    const openrouter = createOpenRouter({
      apiKey: openrouterApiKey,
      headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
    });

    const prompt = `Extract concrete action items from this call transcript.

Meeting Title: ${recording.title || 'Unknown'}

Rules:
- Only include items the transcript clearly identifies as actions, decisions, or follow-ups someone agreed to do.
- Owner: use the speaker name from the transcript when explicit. If multiple speakers agree to it, pick the one who committed. If unclear, set owner to null.
- Action: one short imperative sentence (e.g., "Send the proposal by Friday").
- Due date: ISO 8601 format (YYYY-MM-DD) only when explicitly mentioned. Convert relative dates ("next Friday") only if the meeting date is also mentioned. Otherwise set due_date to null.
- Do NOT invent items not in the transcript.
- If there are no action items, return { "items": [] }.

Transcript:
${limitedTranscript}`;

    let llmItems: ActionItem[];
    try {
      const result = await generateObject({
        model: openrouter('openai/gpt-5-nano'),
        schema: ActionItemsSchema,
        prompt,
      });
      llmItems = result.object.items;
    } catch (err) {
      console.error('extract_action_items: LLM call failed:', err);
      return mcpError(
        id,
        -32603,
        'Failed to extract action items from this recording',
        corsHeaders,
      );
    }

    const { error: cacheError } = await supabase
      .from('recordings')
      .update({ action_items_cache: { items: llmItems } })
      .eq('id', recordingId);
    if (cacheError) {
      console.error('extract_action_items: cache write failed:', cacheError);
    }

    const lines = [`# Action Items: ${recording.title || 'Untitled'} (extracted)`];
    if (llmItems.length === 0) {
      lines.push('', 'No action items found in this transcript.');
    } else {
      llmItems.forEach((it, i) => {
        const owner = it.owner ? `${it.owner}: ` : '';
        const due = it.due_date ? ` (due ${it.due_date})` : '';
        lines.push(`${i + 1}. ${owner}${it.action}${due}`);
      });
    }
    return mcpOk(id, lines.join('\n'));
  },
};
