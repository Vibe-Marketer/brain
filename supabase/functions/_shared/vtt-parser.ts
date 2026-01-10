/**
 * VTT (WebVTT) transcript parser for Zoom recordings.
 * Parses VTT format and extracts transcript segments with timestamps and optional speaker identification.
 */

export interface TranscriptSegment {
  start_time: string;  // "HH:MM:SS.mmm" format
  end_time: string;    // "HH:MM:SS.mmm" format
  text: string;
  speaker?: string;
}

export interface ParsedTranscript {
  segments: TranscriptSegment[];
  full_text: string;
  duration_seconds: number;
}

/**
 * Parses a VTT (WebVTT) formatted transcript string.
 *
 * @param vttContent - The raw VTT file content
 * @returns Array of parsed transcript segments
 */
export function parseVTT(vttContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vttContent.split('\n');

  let i = 0;

  // Skip WEBVTT header and any metadata
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('Kind:') || line.startsWith('Language:')) {
      i++;
      // Skip NOTE blocks (multi-line comments)
      if (line.startsWith('NOTE')) {
        while (i < lines.length && lines[i].trim() !== '') {
          i++;
        }
      }
      continue;
    }
    break;
  }

  // Parse cues
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and cue identifiers (numeric or alphanumeric)
    if (line === '' || /^\d+$/.test(line) || /^[a-zA-Z0-9-]+$/.test(line)) {
      i++;
      continue;
    }

    // Skip NOTE blocks
    if (line.startsWith('NOTE')) {
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        i++;
      }
      continue;
    }

    // Match timestamp line: "00:00:00.000 --> 00:00:05.000" or "00:00.000 --> 00:05.000"
    const timestampMatch = line.match(
      /^(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})(?:\s|$)/
    );

    if (timestampMatch) {
      const start_time = normalizeTimestamp(timestampMatch[1]);
      const end_time = normalizeTimestamp(timestampMatch[2]);

      // Collect text lines until we hit an empty line or another timestamp
      const textLines: string[] = [];
      i++;
      while (i < lines.length) {
        const textLine = lines[i];
        const trimmedLine = textLine.trim();

        // Stop at empty line or next timestamp
        if (trimmedLine === '') {
          break;
        }
        if (/^(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->/.test(trimmedLine)) {
          break;
        }
        // Stop at cue identifier (just a number)
        if (/^\d+$/.test(trimmedLine)) {
          break;
        }

        textLines.push(trimmedLine);
        i++;
      }

      if (textLines.length > 0) {
        const rawText = textLines.join(' ');
        const { text, speaker } = extractSpeaker(rawText);

        segments.push({
          start_time,
          end_time,
          text: cleanVTTTags(text),
          ...(speaker && { speaker }),
        });
      }
    } else {
      i++;
    }
  }

  return segments;
}

/**
 * Normalizes a timestamp to HH:MM:SS.mmm format.
 * Handles both "MM:SS.mmm" and "HH:MM:SS.mmm" formats.
 */
function normalizeTimestamp(timestamp: string): string {
  const parts = timestamp.split(':');
  if (parts.length === 2) {
    // MM:SS.mmm format - add hours
    return `00:${parts[0]}:${parts[1]}`;
  }
  // Already in HH:MM:SS.mmm format
  return timestamp;
}

/**
 * Extracts speaker name from text if present.
 * Common formats: "Speaker Name: text" or "<v Speaker Name>text</v>"
 */
function extractSpeaker(text: string): { text: string; speaker?: string } {
  // Check for VTT voice span format: <v Speaker Name>text</v>
  const voiceMatch = text.match(/^<v\s+([^>]+)>(.+?)(?:<\/v>)?$/);
  if (voiceMatch) {
    return {
      speaker: voiceMatch[1].trim(),
      text: voiceMatch[2].trim(),
    };
  }

  // Check for simple "Speaker Name: text" format
  // Match pattern like "John Smith:" or "Speaker 1:" at the beginning
  const speakerMatch = text.match(/^([A-Za-z][A-Za-z0-9\s.'_-]{0,49}):\s+(.+)$/);
  if (speakerMatch) {
    // Validate speaker name isn't just a URL or timestamp
    const potentialSpeaker = speakerMatch[1];
    if (!potentialSpeaker.includes('://') && !potentialSpeaker.match(/^\d{1,2}:\d{2}/)) {
      return {
        speaker: potentialSpeaker.trim(),
        text: speakerMatch[2].trim(),
      };
    }
  }

  return { text };
}

/**
 * Removes VTT formatting tags from text.
 * Removes tags like <b>, <i>, <u>, <c>, <lang>, etc.
 */
function cleanVTTTags(text: string): string {
  // Remove VTT tags like <b>, <i>, <u>, <c.classname>, <lang xx>, etc.
  return text
    .replace(/<\/?[biu]>/gi, '')
    .replace(/<\/?c(?:\.[^>]*)?>/gi, '')
    .replace(/<\/?lang[^>]*>/gi, '')
    .replace(/<\/?v[^>]*>/gi, '')
    .replace(/<\/?ruby>/gi, '')
    .replace(/<\/?rt>/gi, '')
    .trim();
}

/**
 * Converts a VTT timestamp (HH:MM:SS.mmm) to seconds.
 */
export function timestampToSeconds(timestamp: string): number {
  const normalized = normalizeTimestamp(timestamp);
  const parts = normalized.split(':');

  if (parts.length !== 3) {
    return 0;
  }

  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const secondsParts = parts[2].split('.');
  const seconds = parseInt(secondsParts[0], 10) || 0;
  const milliseconds = parseInt(secondsParts[1] || '0', 10) || 0;

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Converts seconds to a VTT timestamp (HH:MM:SS.mmm).
 */
export function secondsToTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Parses VTT content and returns a full transcript object with metadata.
 */
export function parseVTTWithMetadata(vttContent: string): ParsedTranscript {
  const segments = parseVTT(vttContent);

  // Build full text from segments, grouping by speaker
  const textParts: string[] = [];
  let lastSpeaker: string | undefined;

  for (const segment of segments) {
    if (segment.speaker && segment.speaker !== lastSpeaker) {
      textParts.push(`\n${segment.speaker}: ${segment.text}`);
      lastSpeaker = segment.speaker;
    } else if (segment.speaker) {
      textParts.push(segment.text);
    } else {
      textParts.push(segment.text);
      lastSpeaker = undefined;
    }
  }

  const full_text = textParts.join(' ').trim().replace(/\n /g, '\n');

  // Calculate duration from last segment's end time
  let duration_seconds = 0;
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    duration_seconds = timestampToSeconds(lastSegment.end_time);
  }

  return {
    segments,
    full_text,
    duration_seconds,
  };
}

/**
 * Consolidates adjacent segments from the same speaker into single blocks.
 * Useful for creating a cleaner transcript with speaker turns.
 */
export function consolidateBySpeaker(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length === 0) {
    return [];
  }

  const consolidated: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const segment of segments) {
    if (!current) {
      current = { ...segment };
      continue;
    }

    // If same speaker (or both undefined), merge
    if (current.speaker === segment.speaker) {
      current.end_time = segment.end_time;
      current.text = `${current.text} ${segment.text}`;
    } else {
      consolidated.push(current);
      current = { ...segment };
    }
  }

  if (current) {
    consolidated.push(current);
  }

  return consolidated;
}
