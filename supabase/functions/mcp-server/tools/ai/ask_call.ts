import { enforceMcpAiUsage } from '../../../_shared/track-ai-usage-inline.ts';
import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const askCallTool: ToolModule = {
  definition: { name: 'ask_call' },
  category: 'ai',
  async handler({ id, params, supabase, mcpToken, corsHeaders, fetchOrgWorkspaceIds }) {
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

    const question = typeof params.question === 'string' ? params.question.trim() : '';
    if (!question) return mcpError(id, -32602, 'question is required', corsHeaders);
    if (question.length > 500) {
      return mcpError(id, -32602, 'question must be 500 characters or fewer', corsHeaders);
    }

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
      .select('id, title, full_transcript')
      .eq('id', recordingId)
      .maybeSingle();

    if (recError || !recording) {
      return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
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
      actionType: 'mcp_ask_call',
      recordingId,
    });
    if (!gate.allowed) {
      return mcpError(id, -32001, gate.reason, corsHeaders);
    }

    const limitedTranscript =
      transcript.length > 15000
        ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for Q&A...]'
        : transcript;

    const [{ createOpenRouter }, { generateText }] = await Promise.all([
      import('https://esm.sh/@openrouter/ai-sdk-provider@1.2.8'),
      import('https://esm.sh/ai@5.0.102'),
    ]);

    const openrouter = createOpenRouter({
      apiKey: openrouterApiKey,
      headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
    });

    const systemPrompt =
      'You are answering a question about a call recording. Quote the transcript directly when possible. ' +
      'If the question cannot be answered from the transcript alone, say so explicitly. Do not speculate beyond what the transcript supports.';

    let answer: string;
    try {
      const result = await generateText({
        model: openrouter('openai/gpt-5-nano'),
        system: systemPrompt,
        prompt: `Meeting Title: ${recording.title || 'Unknown'}

Transcript:
${limitedTranscript}

Question: ${question}

Answer:`,
        maxTokens: 800,
      });
      answer = result.text;
    } catch (err) {
      console.error('ask_call: LLM call failed:', err);
      return mcpError(id, -32603, 'Failed to answer question', corsHeaders);
    }

    return mcpOk(id, `Q: ${question}\nA: ${answer}`);
  },
};
