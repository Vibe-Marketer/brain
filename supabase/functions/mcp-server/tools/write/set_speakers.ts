import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import {
  normalizeSetSpeakerInputs,
  resolveSpeakerMatches,
  type ExistingSpeaker,
  type IngestSpeakerInput,
} from './_ingest_helpers.ts';
import { verifyRecordingAccess } from './_access.ts';

const MAX_SPEAKERS = 200;

function displaySpeaker(input: IngestSpeakerInput): string {
  const name = input.name?.trim();
  const email = input.email?.trim();
  if (name && email) return `${name} <${email}>`;
  return name ?? email ?? 'unknown speaker';
}

export const setSpeakersTool: ToolModule = {
  definition: { name: 'set_speakers' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, corsHeaders, mcpToken } = context;
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

    const speakers = normalizeSetSpeakerInputs(params.speakers);
    if (speakers.length === 0) return mcpError(id, -32602, 'speakers must be a non-empty array', corsHeaders);
    if (speakers.length > MAX_SPEAKERS) {
      return mcpError(id, -32602, `speakers exceeds ${MAX_SPEAKERS} entries`, corsHeaders);
    }

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

    const { data: rec, error: recError } = await supabase
      .from('recordings')
      .select('title, organization_id')
      .eq('id', recordingId)
      .maybeSingle();
    if (recError || !rec) {
      return mcpError(id, -32603, 'Failed to load recording before speaker update', corsHeaders);
    }

    const organizationId = rec.organization_id as string | null;
    if (!organizationId) return mcpError(id, -32603, 'Recording missing organization_id', corsHeaders);

    const { data: existingRows } = await supabase
      .from('call_participants')
      .select('id, name, email')
      .eq('organization_id', organizationId)
      .eq('participant_type', 'speaker');

    const summary = resolveSpeakerMatches(speakers, (existingRows ?? []) as ExistingSpeaker[]);

    const warnings: string[] = [];
    const matchedInserted: string[] = [];
    const createdInserted: string[] = [];
    const unchanged: string[] = [];

    const { data: recordingRows } = await supabase
      .from('call_participants')
      .select('name, email')
      .eq('recording_id', recordingId)
      .eq('participant_type', 'speaker');
    const existingRecordingKeys = new Set(
      ((recordingRows ?? []) as Array<{ name: string | null; email: string | null }>).map((row) =>
        `${(row.name ?? '').trim().toLowerCase()}|${(row.email ?? '').trim().toLowerCase()}`
      ),
    );

    const participantsToMirror: Array<{ name: string; email: string | null }> = [];

    const ensureParticipant = async (source: IngestSpeakerInput): Promise<void> => {
      const name = source.name?.trim() ?? '';
      const email = source.email?.trim().toLowerCase() ?? '';
      if (!name && !email) return;

      const dedupKey = `${name.toLowerCase()}|${email}`;
      if (existingRecordingKeys.has(dedupKey)) {
        unchanged.push(displaySpeaker(source));
        if (name) participantsToMirror.push({ name, email: email || null });
        return;
      }

      const { error } = await supabase
        .from('call_participants')
        .insert({
          recording_id: recordingId,
          organization_id: organizationId,
          name: name || null,
          email: email || null,
          participant_type: 'speaker',
          sources: ['mcp_manual'],
        });
      if (error) {
        warnings.push(`Failed to upsert participant ${displaySpeaker(source)}: ${error.message}`);
        return;
      }
      existingRecordingKeys.add(dedupKey);
      if (name) participantsToMirror.push({ name, email: email || null });
    };

    for (const matched of summary.matched) {
      await ensureParticipant(matched.input);
      matchedInserted.push(displaySpeaker(matched.input));
    }
    for (const created of summary.created) {
      await ensureParticipant(created);
      createdInserted.push(displaySpeaker(created));
    }

    // Compatibility mirror for analytics still reading call_speakers.
    for (const participant of participantsToMirror) {
      const normalizedEmail = participant.email?.trim().toLowerCase() ?? null;
      const normalizedName = participant.name.trim();
      if (!normalizedName) continue;

      let speakerId: string | null = null;
      if (normalizedEmail) {
        const { data: byEmail } = await supabase
          .from('speakers')
          .select('id')
          .eq('user_id', mcpToken.user_id)
          .eq('email', normalizedEmail)
          .maybeSingle();
        speakerId = (byEmail as { id?: string } | null)?.id ?? null;
      }
      if (!speakerId) {
        const { data: byName } = await supabase
          .from('speakers')
          .select('id')
          .eq('user_id', mcpToken.user_id)
          .eq('name', normalizedName)
          .maybeSingle();
        speakerId = (byName as { id?: string } | null)?.id ?? null;
      }
      if (!speakerId) {
        const { data: insertedSpeaker, error: speakerInsertError } = await supabase
          .from('speakers')
          .insert({
            user_id: mcpToken.user_id,
            name: normalizedName,
            email: normalizedEmail,
          })
          .select('id')
          .single();
        if (speakerInsertError || !insertedSpeaker) {
          warnings.push(`Failed to mirror analytics speaker ${normalizedName}`);
          continue;
        }
        speakerId = (insertedSpeaker as { id: string }).id;
      }

      const { error: mirrorError } = await supabase
        .from('call_speakers')
        .upsert({
          recording_id: recordingId,
          speaker_id: speakerId,
          user_id: mcpToken.user_id,
        }, { onConflict: 'recording_id,speaker_id' });
      if (mirrorError) {
        warnings.push(`Failed to mirror analytics link for ${normalizedName}: ${mirrorError.message}`);
      }
    }

    const unresolvedLines = summary.unresolved.map((input) => `- ${displaySpeaker(input)}`);
    const ambiguousLines = summary.ambiguous.map((entry) => {
      const candidates = entry.candidates.map((candidate) => displaySpeaker(candidate)).join(', ');
      return `- ${displaySpeaker(entry.input)} (candidates: ${candidates})`;
    });

    const lines: string[] = [
      '# Speakers Updated',
      '',
      `Recording: \`${recordingId}\``,
      `Title: ${rec.title ?? 'Untitled'}`,
      '',
      '## Result',
      `Matched: ${matchedInserted.length}`,
      `Created: ${createdInserted.length}`,
      `Unchanged: ${unchanged.length}`,
      `Unresolved: ${summary.unresolved.length}`,
      `Ambiguous: ${summary.ambiguous.length}`,
    ];

    if (matchedInserted.length > 0) lines.push('', '### Matched', ...matchedInserted.map((item) => `- ${item}`));
    if (createdInserted.length > 0) lines.push('', '### Created', ...createdInserted.map((item) => `- ${item}`));
    if (unresolvedLines.length > 0) lines.push('', '### Unresolved', ...unresolvedLines);
    if (ambiguousLines.length > 0) lines.push('', '### Ambiguous', ...ambiguousLines);
    if (unresolvedLines.length > 0 || ambiguousLines.length > 0) {
      lines.push(
        '',
        'Clarification prompt: Please provide first name, last name, email, and role/company for unresolved or ambiguous speakers.',
      );
    }
    if (warnings.length > 0) lines.push('', '## Warnings', ...warnings.map((warning) => `- ${warning}`));

    return mcpOk(id, lines.join('\n'));
  },
};
