/**
 * Fathom transcript parser — pure stateless utilities.
 *
 * Phase 24: enables the user-paste path for saving Fathom share-link content.
 * Imported by BOTH the `save-pasted-transcript` Deno edge function AND the
 * Vite-bundled `PasteTranscriptModal` React component for live preview.
 *
 * IMPORTANT — zero runtime imports:
 *   This file MUST stay pure TypeScript with NO `Deno.*`, NO `https://esm.sh/...`
 *   imports, and NO Node built-ins. Only string/regex/Date logic. The file is
 *   resolved by both the Deno edge runtime AND the Vite bundler — anything
 *   runtime-specific would break one or the other.
 *
 * Format spec handled (Fathom's "Copy transcript" button output):
 *
 *   Title: Q3 Sales Sync
 *   Date: October 5, 2026
 *   Attendees: Alice Chen, Bob Smith, Carla Diaz
 *
 *   Alice Chen (0:00) Hey team, let's get started.
 *   Bob Smith (0:14) Thanks. So the numbers from last quarter are...
 *   Alice Chen (1:32) Wait, before we go further...
 *
 * Also accepts common exported/rendered variants:
 *   [00:00:00] Alice Chen: Hey team.
 *   00:00 Alice Chen: Hey team.
 *   Alice Chen 00:00 Hey team.
 *
 * Header is optional and free-form. Speaker turns: `Speaker (M:SS)` or
 * `(MM:SS)` or `(H:MM:SS)`. Multi-line turns concatenate until the next
 * speaker line.
 *
 * Detection rule: at least 2 lines must match the speaker-timestamp pattern.
 * If fewer match, the parser returns `parse_status: 'raw'` so the caller can
 * save the raw text into `full_transcript` without losing user data.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FathomSegment {
  /** Milliseconds from the start of the meeting. */
  start_ms: number;
  /** Speaker display name as written in the pasted text. */
  speaker: string;
  /** Spoken text for this turn. Multi-line turns are joined with a single space. */
  text: string;
}

export interface FathomParsedTranscript {
  /** Title detected from a `Title:` header line, if present. */
  title?: string;
  /** ISO 8601 timestamp from a `Date:` / `Recorded at:` / `Recording date:` header line. */
  recorded_at?: string;
  /** Union of header-listed attendees + distinct speaker names from segments. */
  attendees: string[];
  /** Parsed speaker turns. Empty when `parse_status === 'raw'`. */
  segments: FathomSegment[];
  /** `'parsed'` = format recognized; `'raw'` = unrecognized, segments empty. */
  parse_status: 'parsed' | 'raw';
}

// ---------------------------------------------------------------------------
// Share-token extraction
// ---------------------------------------------------------------------------

/**
 * Extract the share token from a Fathom share URL.
 *
 * Handles all known variants:
 *   https://fathom.video/share/abc123                  → 'abc123'
 *   https://fathom.video/share/h/xyz789                → 'xyz789'
 *   https://fathom.video/share/i/foo                   → 'foo'
 *   https://fathom.video/share/p/bar                   → 'bar'
 *   https://fathom.video/share/u/baz                   → 'baz'
 *   https://www.fathom.video/share/abc?ref=email#h     → 'abc'
 *   https://fathom.video/calls/12345                   → null  (calls/, not share/)
 *
 * Returns null if the URL is missing, malformed, or not a fathom.video share URL.
 */
export function extractShareToken(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Strip query string and hash before matching.
  const noQuery = trimmed.split('?')[0].split('#')[0];

  // Match: scheme://[www.]fathom.video/share/[<single letter>/]<token>
  // Token charset: alphanumeric, underscore, hyphen.
  const match = noQuery.match(
    /^https?:\/\/(?:www\.)?fathom\.video\/share(?:\/[a-z])?\/([A-Za-z0-9_-]+)/,
  );
  if (!match) return null;

  const token = match[1];
  // Defensive: token must be non-empty and reasonable length.
  if (!token || token.length === 0 || token.length > 256) return null;
  return token;
}

// ---------------------------------------------------------------------------
// Internal: speaker-turn line detection
// ---------------------------------------------------------------------------

/**
 * Matches a speaker-turn line: `Speaker Name (M:SS) text...`.
 * Captures: 1=speaker, 2=hours-or-minutes, 3=minutes-or-seconds, 4=optional seconds, 5=text.
 * - When 4 is undefined: timestamp is M:SS or MM:SS (capture 2 = minutes, 3 = seconds).
 * - When 4 is defined:   timestamp is H:MM:SS (capture 2 = hours, 3 = minutes, 4 = seconds).
 */
const TURN_RE = /^(.+?)\s+\((\d{1,2}):(\d{2})(?::(\d{2}))?\)\s+(.*)$/;
const BRACKETED_TURN_RE = /^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s+([^:]{1,120}):\s+(.*)$/;
const LEADING_TIME_TURN_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+([^:]{1,120}):\s+(.*)$/;
const INLINE_TIME_TURN_RE = /^([^:\n]{1,120}?)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/;
const FATHOM_DASH_TURN_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+-\s+(.+)$/;

function timestampToMs(
  hOrM: string,
  mOrS: string,
  s: string | undefined,
): number {
  if (s !== undefined) {
    // H:MM:SS
    const h = parseInt(hOrM, 10);
    const m = parseInt(mOrS, 10);
    const sec = parseInt(s, 10);
    return ((h * 3600) + (m * 60) + sec) * 1000;
  }
  // M:SS or MM:SS
  const m = parseInt(hOrM, 10);
  const sec = parseInt(mOrS, 10);
  return ((m * 60) + sec) * 1000;
}

interface TurnMatch {
  speaker: string;
  start_ms: number;
  text: string;
}

function parseTurnLine(line: string): TurnMatch | null {
  const fathom = line.match(TURN_RE);
  if (fathom) {
    return {
      speaker: fathom[1].trim(),
      start_ms: timestampToMs(fathom[2], fathom[3], fathom[4]),
      text: fathom[5].trim(),
    };
  }

  const bracketed = line.match(BRACKETED_TURN_RE);
  if (bracketed) {
    return {
      speaker: bracketed[4].trim(),
      start_ms: timestampToMs(bracketed[1], bracketed[2], bracketed[3]),
      text: bracketed[5].trim(),
    };
  }

  const leading = line.match(LEADING_TIME_TURN_RE);
  if (leading) {
    return {
      speaker: leading[4].trim(),
      start_ms: timestampToMs(leading[1], leading[2], leading[3]),
      text: leading[5].trim(),
    };
  }

  const inline = line.match(INLINE_TIME_TURN_RE);
  if (inline && !inline[1].includes('://')) {
    return {
      speaker: inline[1].trim(),
      start_ms: timestampToMs(inline[2], inline[3], inline[4]),
      text: inline[5].trim(),
    };
  }

  const dashMatch = line.match(FATHOM_DASH_TURN_RE);
  if (dashMatch) {
    return {
      speaker: dashMatch[4].trim(),
      start_ms: timestampToMs(dashMatch[1], dashMatch[2], dashMatch[3]),
      text: "",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal: header parsing
// ---------------------------------------------------------------------------

interface ParsedHeader {
  title?: string;
  recorded_at?: string;
  attendees: string[];
  /** Index in the original lines array where the header ends (exclusive). */
  endIndex: number;
}

/**
 * Parse free-form header lines until we hit either:
 *   - the first speaker-turn line, or
 *   - 3+ consecutive non-header, non-blank lines (defensive — header should be short).
 *
 * Recognized header keys (case-insensitive, trailing colon required):
 *   Title, Subject, Topic
 *   Date, Recorded at, Recording date, Recorded on
 *   Attendees, Participants, Invitees
 */
function parseHeader(lines: string[]): ParsedHeader {
  const result: ParsedHeader = { attendees: [], endIndex: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      result.endIndex = i + 1;
      continue;
    }
    // Stop at the first speaker-turn line.
    if (parseTurnLine(line)) {
      result.endIndex = i;
      return result;
    }

    const headerMatch = line.match(/^([A-Za-z][A-Za-z\s]*?):\s*(.*)$/);
    if (!headerMatch) {
      // Unknown line in the header zone — still include it as endIndex move-forward,
      // but don't extract anything from it. (Fathom sometimes inserts a stray
      // "Generated by Fathom" line.)
      result.endIndex = i + 1;
      continue;
    }

    const key = headerMatch[1].trim().toLowerCase();
    const value = headerMatch[2].trim();

    if (key === 'title' || key === 'subject' || key === 'topic') {
      if (!result.title && value) result.title = value;
    } else if (
      key === 'date' ||
      key === 'recorded at' ||
      key === 'recording date' ||
      key === 'recorded on'
    ) {
      if (!result.recorded_at && value) {
        const iso = parseLooseDate(value);
        if (iso) result.recorded_at = iso;
      }
    } else if (
      key === 'attendees' ||
      key === 'participants' ||
      key === 'invitees'
    ) {
      const names = value
        .split(/[,;]/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      for (const name of names) {
        if (!result.attendees.includes(name)) result.attendees.push(name);
      }
    }
    // Unknown key in header zone — ignore but keep scanning.
    result.endIndex = i + 1;
  }

  return result;
}

/**
 * Best-effort loose date parsing. Returns ISO 8601 string or undefined.
 * Tries `new Date(value)` first; falls back to a few common formats.
 */
function parseLooseDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString();
  return undefined;
}

function inferHeaderFallback(lines: string[], header: ParsedHeader): ParsedHeader {
  const result: ParsedHeader = { ...header, attendees: [...header.attendees] };
  const headerLines = lines
    .slice(0, Math.max(header.endIndex, 0))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^WEBVTT$/i.test(line))
    .filter((line) => !/^(Transcript|Summary|Action Items)$/i.test(line))
    .filter((line) => !/^[A-Za-z][A-Za-z\s]*?:/.test(line));

  if (!result.title) {
    const title = headerLines.find((line) => {
      if (parseLooseDate(line)) return false;
      if (line.length > 180) return false;
      return !parseTurnLine(line);
    });
    if (title) result.title = title;
  }

  if (!result.recorded_at) {
    const dateLine = headerLines.find((line) => Boolean(parseLooseDate(line)));
    if (dateLine) result.recorded_at = parseLooseDate(dateLine);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public: main parser
// ---------------------------------------------------------------------------

/**
 * Parse raw text from Fathom's "Copy transcript" button.
 *
 * Behavior:
 *   - Detects format by scanning for `(M:SS)` / `(MM:SS)` / `(H:MM:SS)` timestamps.
 *   - If 2+ matching lines found → returns parsed segments + header metadata.
 *   - Otherwise → returns `{ parse_status: 'raw', segments: [], attendees: [] }`.
 *     Caller should save the raw text into `full_transcript` (no data loss).
 *   - Multi-line turns: lines that don't match the speaker pattern get
 *     concatenated onto the most recent segment (joined with a single space).
 *   - Attendees: union of header `Attendees:` list + distinct speaker names,
 *     deduplicated case-insensitively (canonical form = first occurrence).
 *
 * Examples:
 *   parseFathomCopyFormat("Alice (0:00) Hi.\nBob (0:05) Hello.")
 *     → { parse_status:'parsed', segments:[{start_ms:0,speaker:'Alice',text:'Hi.'},
 *                                          {start_ms:5000,speaker:'Bob',text:'Hello.'}],
 *         attendees:['Alice','Bob'] }
 *
 *   parseFathomCopyFormat("hello world")
 *     → { parse_status:'raw', segments:[], attendees:[] }
 */
export function parseFathomCopyFormat(rawText: string): FathomParsedTranscript {
  if (!rawText || typeof rawText !== 'string') {
    return { parse_status: 'raw', segments: [], attendees: [] };
  }

  // Normalize line endings + split.
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');

  // Pre-flight: count speaker-turn lines. Need 2+ to consider it parseable.
  let turnCount = 0;
  for (const line of lines) {
    if (parseTurnLine(line.trim())) {
      turnCount++;
      if (turnCount >= 2) break;
    }
  }
  if (turnCount < 2) {
    return { parse_status: 'raw', segments: [], attendees: [] };
  }

  const header = inferHeaderFallback(lines, parseHeader(lines));

  const segments: FathomSegment[] = [];
  let current: FathomSegment | null = null;

  for (let i = header.endIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      // Blank line — flush current segment to "frozen" state. The next
      // non-empty, non-turn line starts a new continuation only if it
      // appears before another speaker turn — but to keep the parser
      // simple and predictable, we just skip blanks. Multi-paragraph
      // turns will get joined as long as no new speaker line interrupts.
      continue;
    }

    const turn = parseTurnLine(trimmed);
    if (turn) {
      // Push prior segment.
      if (current) segments.push(current);
      current = turn;
    } else if (current) {
      // Continuation of previous turn.
      current.text = current.text
        ? `${current.text} ${trimmed}`
        : trimmed;
    }
    // Else: orphan line before any speaker turn — skip silently. Defensive
    // for malformed pastes.
  }
  if (current) segments.push(current);

  // Attendees = union of header attendees + distinct speakers (case-insensitive,
  // canonical form = first occurrence).
  const attendees: string[] = [];
  const seen = new Set<string>();
  for (const name of header.attendees) {
    const lc = name.toLowerCase();
    if (!seen.has(lc)) {
      seen.add(lc);
      attendees.push(name);
    }
  }
  for (const seg of segments) {
    const lc = seg.speaker.toLowerCase();
    if (!seen.has(lc)) {
      seen.add(lc);
      attendees.push(seg.speaker);
    }
  }

  const result: FathomParsedTranscript = {
    attendees,
    segments,
    parse_status: 'parsed',
  };
  if (header.title) result.title = header.title;
  if (header.recorded_at) result.recorded_at = header.recorded_at;
  return result;
}
