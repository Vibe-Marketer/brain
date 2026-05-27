/**
 * Otter.ai TXT export parser.
 *
 * Otter.ai exports transcripts as plain text files with:
 * - An optional "Transcript by Otter.ai" header / branding line
 * - Optional meeting title as the first non-branding line
 * - Speaker turns in "Speaker Name: text body" format
 * - No timestamps (or timestamps in a different format than VTT/SRT)
 *
 * This parser:
 * 1. Detects Otter format via heuristics (branding header OR dense speaker:text lines)
 * 2. Extracts optional title from the first non-branding, non-speaker-turn line
 * 3. Produces speaker turns with preserved text
 */

export interface OtterSegment {
  speaker: string;
  text: string;
  /** Line order (0-indexed), used for preserving turn sequence */
  order: number;
}

export interface ParsedOtter {
  segments: OtterSegment[];
  full_text: string;
  speakers: string[];
  title?: string;
}

/**
 * Returns true if content looks like an Otter.ai TXT export.
 *
 * Heuristics (checked in order):
 * 1. Contains "Otter.ai" in the first 1000 chars (explicit branding)
 * 2. Has >= 3 "SpeakerName: text body" lines (>= 20 chars after colon)
 *    without SRT/VTT timestamp markers being present
 *
 * Guards:
 * - VTT content (WEBVTT header) → not Otter
 * - SRT content (comma timestamp) → not Otter
 */
export function isOtterContent(content: string): boolean {
  // VTT guard
  if (/^\s*WEBVTT\b/i.test(content)) return false;
  // SRT guard (comma millisecond timestamps)
  if (/\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(content)) return false;

  // Explicit Otter.ai branding
  const head = content.slice(0, 1000);
  if (/otter\.ai/i.test(head)) return true;

  // Dense speaker:text lines without timestamps
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const speakerLines = lines.filter(
    (l) =>
      // "Name: text body" — name up to 50 chars, text at least 20 chars
      /^[A-Za-z][A-Za-z0-9\s.'_-]{0,49}:\s+.{20,}/.test(l) &&
      // Not a URL
      !l.startsWith('http') &&
      // Not a timestamp
      !l.match(/^\d{2}:/)
  );
  return speakerLines.length >= 3;
}

/**
 * Extracts a title from the Otter export header.
 * Looks at the first 10 non-empty lines before any speaker turn starts.
 * Returns the first line that looks like a title (not branding, not a speaker turn).
 */
function extractOtterTitle(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 10)) {
    if (!line) continue;
    // Skip Otter.ai branding lines
    if (/otter\.ai/i.test(line)) continue;
    // If we hit a speaker turn, stop looking for a title
    if (/^[A-Za-z][A-Za-z0-9\s.'_-]{0,49}:\s+/.test(line)) break;
    // Accept any non-trivial line as a title candidate (5–300 chars)
    if (line.length >= 5 && line.length <= 300) return line;
  }
  return undefined;
}

/**
 * Parses Otter.ai TXT export content into structured speaker turns.
 * Gracefully returns empty segments for content that doesn't match.
 */
export function parseOtter(content: string): ParsedOtter {
  const rawLines = content.split('\n').map((l) => l.trim());
  const nonEmptyLines = rawLines.filter(Boolean);
  const title = extractOtterTitle(nonEmptyLines);

  const segments: OtterSegment[] = [];
  const speakerSet = new Set<string>();
  let order = 0;

  for (const line of rawLines) {
    if (!line) continue;
    // Skip Otter.ai branding
    if (/otter\.ai/i.test(line)) continue;

    // Match "Speaker Name: text body"
    const match = line.match(/^([A-Za-z][A-Za-z0-9\s.'_-]{0,49}):\s+(.+)$/);
    if (match && !match[1].startsWith('http') && !match[1].match(/^\d{2}:/)) {
      const speaker = match[1].trim();
      const text = match[2].trim();
      speakerSet.add(speaker);
      segments.push({ speaker, text, order: order++ });
    }
  }

  const full_text = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');

  return {
    segments,
    full_text,
    speakers: Array.from(speakerSet),
    ...(title && { title }),
  };
}
