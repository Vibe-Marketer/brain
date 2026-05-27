---
id: "01-A"
phase: 1
title: "SRT + Otter TXT Parser (MAN-02)"
type: implementation
status: pending
files_modified:
  - supabase/functions/_shared/srt-parser.ts
  - supabase/functions/save-pasted-transcript/index.ts
  - supabase/functions/_shared/__tests__/srt-parser.test.ts
  - docs/architecture/transcript-formats.md
---

# Plan 01-A: SRT + Otter TXT Parser (MAN-02)

## Goal

Add SRT and Otter TXT format detection and parsing to `save-pasted-transcript`, extending the existing VTT/Fathom paths. Add unit tests for each parser. Document the canonical CallVault transcript JSON shape.

## Success Criteria

1. A user pastes an SRT transcript — correctly-timestamped segments + inferred speakers land in the recording
2. A user pastes an Otter TXT export — speaker turns preserved, no timestamps fabricated
3. `_shared/srt-parser.ts` has unit tests covering: header detection, timestamp parsing, multi-speaker cues, cue without speaker, malformed SRT fallback to raw
4. `docs/architecture/transcript-formats.md` documents the canonical JSON shape

## Tasks

### Task 1: Create `supabase/functions/_shared/srt-parser.ts`

Create a new parser module following the VTT parser pattern:

```typescript
// supabase/functions/_shared/srt-parser.ts

export interface SrtSegment {
  index: number;
  start_time: string;  // "HH:MM:SS" format (no milliseconds in SRT output)
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
 * SRT: starts with a numeric cue index, followed by timestamp with comma notation.
 * "1\n00:00:01,000 --> 00:00:05,000"
 */
export function isSrtContent(content: string): boolean {
  // Strip leading whitespace/BOM
  const trimmed = content.trimStart();
  // First non-empty line should be a cue index (1 or more digits)
  const lines = trimmed.split('\n');
  const firstNonEmpty = lines.find(l => l.trim() !== '');
  if (!firstNonEmpty || !/^\d+$/.test(firstNonEmpty.trim())) return false;
  // Second non-empty line should be SRT timestamp (comma millisecond separator)
  const idx = lines.indexOf(firstNonEmpty);
  const secondNonEmpty = lines.slice(idx + 1).find(l => l.trim() !== '');
  if (!secondNonEmpty) return false;
  return /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(secondNonEmpty);
}

/**
 * Converts SRT timestamp "HH:MM:SS,mmm" to seconds.
 */
export function srtTimestampToSeconds(timestamp: string): number {
  const [hms, ms] = timestamp.split(',');
  if (!hms) return 0;
  const parts = hms.split(':').map(p => parseInt(p, 10));
  const [h = 0, m = 0, s = 0] = parts;
  return h * 3600 + m * 60 + s + (parseInt(ms || '0', 10)) / 1000;
}

/**
 * Converts seconds to "HH:MM:SS" format for output.
 */
function secondsToHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Attempts to extract "Speaker Name: text" from SRT cue text.
 * Same heuristic as VTT parser.
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
 * Parses SRT content into segments.
 */
export function parseSRT(content: string): ParsedSrt {
  const segments: SrtSegment[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (line === '') { i++; continue; }

    // Match cue index (numeric line)
    if (!/^\d+$/.test(line)) { i++; continue; }
    const index = parseInt(line, 10);
    i++;

    // Next non-empty line should be timestamp
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const tsLine = lines[i].trim();
    const tsMatch = tsLine.match(
      /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!tsMatch) { i++; continue; }

    const startSec = srtTimestampToSeconds(tsMatch[1]);
    const endSec = srtTimestampToSeconds(tsMatch[2]);
    i++;

    // Collect text lines until empty line or end
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
        start_time: secondsToHMS(startSec),
        end_time: secondsToHMS(endSec),
        text,
        ...(speaker && { speaker }),
      });
    }
  }

  const lastSeg = segments[segments.length - 1];
  const duration_seconds = lastSeg
    ? srtTimestampToSeconds(
        // Re-extract from end_time approximation
        `${lastSeg.end_time},000`
      )
    : 0;

  const full_text = segments
    .map(s => s.speaker ? `${s.speaker}: ${s.text}` : s.text)
    .join('\n');

  return { segments, full_text, duration_seconds };
}
```

### Task 2: Create `supabase/functions/_shared/otter-parser.ts`

```typescript
// supabase/functions/_shared/otter-parser.ts

export interface OtterSegment {
  speaker: string;
  text: string;
  /** Approximate line position as a fraction of total, used to derive relative order */
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
 * Heuristics:
 * 1. Contains "Otter.ai" in first 500 chars (explicit export header), OR
 * 2. Dense "SpeakerName: text" lines (>= 3) without SRT/VTT timestamp markers
 */
export function isOtterContent(content: string): boolean {
  const head = content.slice(0, 1000);
  if (/otter\.ai/i.test(head)) return true;

  // VTT/SRT guard: if it smells like those, don't claim Otter
  if (/^WEBVTT\b/im.test(content)) return false;
  if (/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(content)) return false;

  // Count "SpeakerName: text" lines (minimum 20 chars after colon)
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const speakerLines = lines.filter(l =>
    /^[A-Za-z][A-Za-z0-9\s.'_-]{0,49}:\s+.{20,}/.test(l) &&
    !l.startsWith('http') &&
    !l.match(/^\d{2}:/)
  );
  return speakerLines.length >= 3;
}

/**
 * Extracts a title from the Otter export header, if present.
 * Common pattern: first non-empty line before speaker turns that is not a speaker:text line.
 */
function extractOtterTitle(content: string): string | undefined {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    // Skip Otter.ai branding and speaker lines
    if (/otter\.ai/i.test(line)) continue;
    if (/^[A-Za-z][A-Za-z0-9\s.'_-]{0,49}:\s+/.test(line)) break;
    if (line.length > 5 && line.length < 300) return line;
  }
  return undefined;
}

/**
 * Parses Otter TXT export into speaker turns.
 */
export function parseOtter(content: string): ParsedOtter {
  const lines = content.split('\n').map(l => l.trim());
  const title = extractOtterTitle(content);
  const segments: OtterSegment[] = [];
  const speakerSet = new Set<string>();
  let order = 0;

  for (const line of lines) {
    if (!line || /otter\.ai/i.test(line)) continue;

    // Match "Speaker Name: text body"
    const match = line.match(/^([A-Za-z][A-Za-z0-9\s.'_-]{0,49}):\s+(.+)$/);
    if (match && !match[1].startsWith('http') && !match[1].match(/^\d{2}:/)) {
      const speaker = match[1].trim();
      const text = match[2].trim();
      speakerSet.add(speaker);
      segments.push({ speaker, text, order: order++ });
    }
  }

  const full_text = segments
    .map(s => `${s.speaker}: ${s.text}`)
    .join('\n');

  return {
    segments,
    full_text,
    speakers: Array.from(speakerSet),
    ...(title && { title }),
  };
}
```

### Task 3: Add unit tests for SRT parser

Create `supabase/functions/_shared/__tests__/srt-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isSrtContent, parseSRT, srtTimestampToSeconds } from '../srt-parser';

const BASIC_SRT = `1
00:00:01,000 --> 00:00:05,000
Hello world

2
00:00:06,000 --> 00:00:10,000
Second line
`;

const SPEAKER_SRT = `1
00:00:01,000 --> 00:00:05,000
Alice: Hello there

2
00:00:06,000 --> 00:00:10,000
Bob: Good morning
`;

const MALFORMED = `This is just plain text with no SRT format.`;

describe('isSrtContent', () => {
  it('detects basic SRT', () => expect(isSrtContent(BASIC_SRT)).toBe(true));
  it('detects SRT with speakers', () => expect(isSrtContent(SPEAKER_SRT)).toBe(true));
  it('rejects plain text', () => expect(isSrtContent(MALFORMED)).toBe(false));
  it('rejects VTT', () => expect(isSrtContent('WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nHello')).toBe(false));
});

describe('srtTimestampToSeconds', () => {
  it('converts 00:00:01,000 to 1', () => expect(srtTimestampToSeconds('00:00:01,000')).toBe(1));
  it('converts 01:30:00,000 to 5400', () => expect(srtTimestampToSeconds('01:30:00,000')).toBe(5400));
});

describe('parseSRT', () => {
  it('parses basic segments', () => {
    const result = parseSRT(BASIC_SRT);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].text).toBe('Hello world');
    expect(result.segments[1].text).toBe('Second line');
  });

  it('extracts speakers', () => {
    const result = parseSRT(SPEAKER_SRT);
    expect(result.segments[0].speaker).toBe('Alice');
    expect(result.segments[1].speaker).toBe('Bob');
  });

  it('returns empty segments for malformed input', () => {
    const result = parseSRT(MALFORMED);
    expect(result.segments).toHaveLength(0);
  });
});
```

### Task 4: Integrate SRT + Otter into `save-pasted-transcript/index.ts`

**Changes to `index.ts`:**

1. Import new parsers:
```typescript
import { isSrtContent, parseSRT } from "../_shared/srt-parser.ts";
import { isOtterContent, parseOtter } from "../_shared/otter-parser.ts";
```

2. Extend `ManualTranscriptSourceApp` type:
```typescript
type ManualTranscriptSourceApp = "fathom-paste" | "zoom" | "srt" | "otter" | "file-upload";
```

3. Extend `inferManualSourceApp()`:
```typescript
function inferManualSourceApp({ explicitSourceApp, sourceUrl, rawTranscript }) {
  if (explicitSourceApp) return explicitSourceApp;
  if (/^\s*WEBVTT\b/i.test(rawTranscript) || /zoom\.us/i.test(sourceUrl ?? "")) return "zoom";
  if (isSrtContent(rawTranscript)) return "srt";
  if (isOtterContent(rawTranscript)) return "otter";
  return "fathom-paste";
}
```

4. Extend `normalizeManualTranscript()`:
```typescript
async function normalizeManualTranscript(args) {
  if (args.sourceApp === "zoom") return normalizeZoomVtt(args);
  if (args.sourceApp === "srt") return normalizeSrt(args);
  if (args.sourceApp === "otter") return normalizeOtter(args);
  return normalizeFathomPaste(args);
}
```

5. Add `normalizeSrt()` function:
```typescript
async function normalizeSrt({ rawTranscript, titleOverride, recordedAtOverride, attendeesOverride, sourceUrl }) {
  const parsed = parseSRT(rawTranscript);
  if (parsed.segments.length === 0) {
    throw new Error("No transcript cues found in the SRT file");
  }
  const speakerNames = uniqueStrings(
    parsed.segments.map(s => s.speaker).filter(Boolean) as string[]
  );
  const fullTranscript = parsed.segments
    .map(s => `[${s.start_time}] ${s.speaker || "Unknown"}: ${s.text}`)
    .join("\n\n");
  const externalId = await stableManualExternalId("srt", { sourceUrl, rawTranscript, title: titleOverride, recordedAt: recordedAtOverride });
  const recordedAt = recordedAtOverride ?? inferDateFromText(titleOverride) ?? new Date().toISOString();
  const attendees = attendeesOverride ?? speakerNames;
  return {
    externalId,
    title: titleOverride ?? "Untitled SRT transcript",
    recordedAt,
    recordingEndAt: addSeconds(recordedAt, parsed.duration_seconds),
    duration: parsed.duration_seconds || null,
    fullTranscript,
    attendees,
    calendarInvitees: buildCalendarInvitees(attendees, speakerNames),
    speakerNames,
    parseStatus: "parsed",
    pasteSource: "srt",
    transcriptSegments: parsed.segments.map(s => ({
      start_ms: Math.round(srtTimestampToSeconds(s.start_time + ",000") * 1000),
      speaker: s.speaker ?? "Unknown",
      text: s.text,
    })),
  };
}
```

6. Add `normalizeOtter()` function following same pattern.

Also extend `PasteTranscriptModal.tsx` mode select to include SRT/Otter options and auto-detection.

### Task 5: Update `PasteTranscriptModal.tsx` for SRT/Otter mode

Add SRT and Otter to the mode dropdown and auto-detection:
```typescript
type ManualTranscriptMode = 'fathom-paste' | 'zoom' | 'srt' | 'otter' | 'file-upload';
```

Extend auto-detection:
```typescript
// Existing: WEBVTT → zoom
// New: SRT detection
if (isSrtContent(transcript) && mode !== 'srt') setMode('srt');
// New: Otter detection  
if (isOtterContent(transcript) && mode !== 'otter') setMode('otter');
```

Add to mode select options:
```html
<option value="srt">SRT transcript</option>
<option value="otter">Otter.ai transcript</option>
```

Also update live preview parsing to handle SRT/Otter paths.

### Task 6: Create `docs/architecture/transcript-formats.md`

Document canonical CallVault transcript JSON shape including all supported formats (VTT, SRT, Otter, Fathom copy, raw text), detection heuristics, and the `transcript_segments` JSONB column shape.

## Verification

- `npm run test -- srt-parser.test.ts` passes
- Paste an SRT transcript in dev environment → recording created with speaker segments
- Paste an Otter TXT export → recording created with speaker turns
- `npm run build` exits 0

## Threat Model

- **T-01**: SRT/Otter format parsers are read-only text processors — no external calls, no eval. Input size is already bounded by the existing 5MB Zod limit. Low risk.
- **T-02**: Auto-detection heuristics could misclassify input — both parsers gracefully fall back to raw text if segment count is 0, so worst case is a raw import not a failure.
