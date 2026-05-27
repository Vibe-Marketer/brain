/**
 * SRT (SubRip Subtitle) transcript parser.
 *
 * Parses SRT format used by video subtitle files. SRT differs from VTT:
 * - Comma millisecond separator: "00:00:01,000 --> 00:00:05,000"
 * - Numeric cue index lines (1, 2, 3...)
 * - No WEBVTT header
 * - Speaker attribution via "Speaker Name: text" convention (same as VTT)
 */

export interface SrtSegment {
  index: number;
  /** "HH:MM:SS" format */
  start_time: string;
  /** "HH:MM:SS" format */
  end_time: string;
  text: string;
  speaker?: string;
}

export interface ParsedSrt {
  segments: SrtSegment[];
  full_text: string;
  duration_seconds: number;
}

/**
 * Returns true if content looks like SRT format.
 * Detection: first non-blank line is a digit-only cue index, and the next
 * non-blank line is an SRT timestamp (comma millisecond separator "HH:MM:SS,mmm --> ...").
 */
export function isSrtContent(content: string): boolean {
  // VTT guard: WEBVTT header means it's not SRT
  if (/^\s*WEBVTT\b/i.test(content)) return false;

  const lines = content.split('\n');
  let i = 0;

  // Skip leading blanks / BOM
  while (i < lines.length && lines[i].trim() === '') i++;

  // First non-empty line must be a numeric cue index
  if (i >= lines.length) return false;
  const firstLine = lines[i].trim();
  if (!/^\d+$/.test(firstLine)) return false;
  i++;

  // Skip blank lines after index
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return false;

  // Second non-empty line must be SRT timestamp with comma millisecond separator
  const tsLine = lines[i].trim();
  return /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(tsLine);
}

/**
 * Converts SRT timestamp "HH:MM:SS,mmm" to seconds.
 */
export function srtTimestampToSeconds(timestamp: string): number {
  const [hms, msStr] = timestamp.split(',');
  if (!hms) return 0;
  const parts = hms.split(':').map((p) => parseInt(p, 10));
  const [h = 0, m = 0, s = 0] = parts;
  const ms = parseInt(msStr ?? '0', 10);
  return h * 3600 + m * 60 + s + ms / 1000;
}

/**
 * Converts seconds to "HH:MM:SS" format.
 */
export function srtSecondsToHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Extracts "Speaker Name: text" from SRT cue text.
 * Same heuristic as vtt-parser.ts extractSpeaker.
 */
function extractSpeaker(text: string): { text: string; speaker?: string } {
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s.'_-]{0,49}):\s+(.+)$/);
  if (match) {
    const potentialSpeaker = match[1];
    if (!potentialSpeaker.includes('://') && !potentialSpeaker.match(/^\d{1,2}:\d{2}/)) {
      return { speaker: potentialSpeaker.trim(), text: match[2].trim() };
    }
  }
  return { text };
}

/**
 * Parses SRT content into structured segments.
 * Gracefully returns empty segments for malformed input.
 */
export function parseSRT(content: string): ParsedSrt {
  const segments: SrtSegment[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    // Skip blank lines
    if (lines[i].trim() === '') { i++; continue; }

    // Match cue index (numeric-only line)
    if (!/^\d+$/.test(lines[i].trim())) { i++; continue; }
    const index = parseInt(lines[i].trim(), 10);
    i++;

    // Skip blanks before timestamp
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    // Parse SRT timestamp line
    const tsMatch = lines[i].trim().match(
      /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!tsMatch) { i++; continue; }

    const startSec = srtTimestampToSeconds(tsMatch[1]);
    const endSec = srtTimestampToSeconds(tsMatch[2]);
    i++;

    // Collect text lines until blank line or end of file
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i].trim());
      i++;
    }

    if (textLines.length > 0) {
      const rawText = textLines.join(' ');
      const { text, speaker } = extractSpeaker(rawText);
      segments.push({
        index,
        start_time: srtSecondsToHMS(startSec),
        end_time: srtSecondsToHMS(endSec),
        text,
        ...(speaker && { speaker }),
      });
    }
  }

  const lastSeg = segments[segments.length - 1];
  const duration_seconds = lastSeg ? srtTimestampToSeconds(`${lastSeg.end_time},000`) : 0;

  const full_text = segments
    .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
    .join('\n');

  return { segments, full_text, duration_seconds };
}
