/**
 * Utility functions for transcript processing and formatting
 */

interface TranscriptSegment {
  speaker_name: string;
  speaker_email: string | null;
  [key: string]: any;
}

interface SpeakerGroup {
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
