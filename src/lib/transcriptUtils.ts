/**
 * Utility functions for transcript processing and formatting
 */

export interface TranscriptSegment {
  id?: string;
  recording_id?: number | string;
  speaker_name: string;
  speaker_email?: string | null;
  text?: string;
  timestamp?: string;
  edited_text?: string | null;
  edited_speaker_name?: string | null;
  edited_speaker_email?: string | null;
  is_deleted?: boolean;
  created_at?: string;
  display_text?: string;
  display_speaker_name?: string;
  display_speaker_email?: string | null;
  has_edits?: boolean;
}

export interface SpeakerGroup {
  speaker: string;
  email: string | null;
  messages: TranscriptSegment[];
}

/**
 * Groups consecutive transcript segments by the same speaker
 * Used to create chat-bubble style UI where consecutive messages from same speaker are grouped
 */
export function groupTranscriptsBySpeaker(transcripts: TranscriptSegment[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];
  let currentGroup: SpeakerGroup | null = null;

  for (const transcript of transcripts) {
    if (!currentGroup || currentGroup.speaker !== transcript.speaker_name) {
      // New speaker, create new group
      currentGroup = {
        speaker: transcript.speaker_name,
        email: transcript.speaker_email,
        messages: [transcript]
      };
      groups.push(currentGroup);
    } else {
      // Same speaker, add to current group
      currentGroup.messages.push(transcript);
    }
  }

  return groups;
}

/**
 * Parses a YouTube-format full_transcript into display segments.
 *
 * YouTube transcripts are stored as plain text with [M:SS] or [H:MM:SS]
 * timestamp markers every ~30 seconds, followed by phrase lines:
 *
 *   [0:00]
 *   first phrase here
 *   second phrase here
 *
 *   [0:30]
 *   next section text
 *
 * Returns one TranscriptSegment per timestamp block with text joined into a paragraph.
 * Sets speaker_name to '' (empty) to signal no speaker attribution.
 */
export function parseYouTubeTranscript(
  fullTranscript: string,
  recordingId: number | string | undefined,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  // Matches [M:SS] or [H:MM:SS] — YouTube timestamps don't zero-pad minutes
  const timestampRe = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  let lastTimestamp: string | null = null;
  let lastIndex = 0;
  let segIdx = 0;
  let match: RegExpExecArray | null;

  const pushSegment = (timestamp: string, rawText: string) => {
    const text = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join(' ')
      .trim();
    if (text) {
      segments.push({
        id: `yt-${segIdx++}`,
        recording_id: recordingId as number,
        timestamp,
        speaker_name: '',
        speaker_email: null,
        text,
        edited_text: null,
        edited_speaker_name: null,
        edited_speaker_email: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
      });
    }
  };

  while ((match = timestampRe.exec(fullTranscript)) !== null) {
    if (lastTimestamp !== null) {
      pushSegment(lastTimestamp, fullTranscript.slice(lastIndex, match.index));
    }
    lastTimestamp = match[1];
    lastIndex = match.index + match[0].length;
  }

  if (lastTimestamp !== null) {
    pushSegment(lastTimestamp, fullTranscript.slice(lastIndex));
  }

  return segments;
}

/**
 * Returns true if the transcript string is in YouTube format.
 * YouTube format has [M:SS] markers but no "Speaker Name: text" lines.
 */
export function isYouTubeTranscriptFormat(transcript: string): boolean {
  const hasTimestampMarkers = /\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(transcript);
  // Standard Fathom/Zoom format has "Speaker: text" after an [HH:MM:SS] header
  const hasStandardSpeakerFormat = /\[\d{2}:\d{2}:\d{2}\]\s+\S[^:\n]*:/.test(transcript);
  return hasTimestampMarkers && !hasStandardSpeakerFormat;
}

/**
 * Formats timestamp from "[HH:MM:SS]" to simplified display format
 * - "[00:00:08]" → ":08"
 * - "[00:09:32]" → "9:32"
 * - "[01:23:45]" → "1:23:45"
 */
export function formatSimpleTimestamp(timestamp: string): string {
  const match = timestamp.match(/\[(\d+):(\d+):(\d+)\]/);
  if (!match) return timestamp;

  const [_, hours, minutes, seconds] = match;
  const h = parseInt(hours);
  const m = parseInt(minutes);

  if (h > 0) {
    // Times over 1 hour: "1:23:44"
    return `${h}:${minutes}:${seconds}`;
  } else if (m > 0) {
    // Times 1-59 minutes: "9:32" or "12:34"
    return `${m}:${seconds}`;
  } else {
    // Times under 1 minute: ":08"
    return `:${seconds}`;
  }
}
