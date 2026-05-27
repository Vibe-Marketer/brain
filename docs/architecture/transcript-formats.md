# Transcript Formats & Parsing Architecture

This document describes the canonical CallVault JSON transcript shape, the supported input formats, detection heuristics, and parsing strategies.

## Overview

CallVault unifies transcripts from various meeting recorder sources (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube, Loom, transcript-file imports, and raw pasted text) into a single, canonical JSON shape stored in the `recordings.transcript_segments` JSONB column.

All parsing is performed statelessly in Deno Edge Functions (primarily `save-pasted-transcript` for manual imports) using pure TypeScript utilities located in `supabase/functions/_shared`.

## Canonical Transcript Shape (`transcript_segments`)

Once parsed, every transcript is converted into an array of segment objects. The canonical shape is:

```typescript
export interface TranscriptSegment {
  /** Milliseconds from the start of the meeting. */
  start_ms: number;
  /** Display name of the speaker. */
  speaker: string;
  /** The spoken text. Multi-line turns are typically joined with a space. */
  text: string;
}
```

This array is stored in the `recordings` table. In addition, the raw imported text is preserved in the `full_transcript` text column for Full-Text Search (FTS) and as a fallback if the parsing fails or the format is entirely unstructured.

Phase 1 manual import contract:

- **D-01: No data loss.** Manual transcript imports parse structure when possible and preserve the exact raw transcript in `full_transcript` whenever structure is weak, malformed, or untrusted.
- **D-02: No invented speakers.** Missing speaker labels become the literal `Unknown Speaker`. Parsers must not infer a speaker from attendees, headers, invitees, or recorder metadata.
- **D-03: Stable timing.** Timestamped formats keep source timing. Formats without trustworthy timestamps use deterministic sequential offsets before falling back to `transcript_segments: null`.
- **D-04: Supported inputs.** Phase 1 manual imports support Loom, VTT, SRT, Otter TXT, Fathom copy, raw text, and Markdown `.md` transcript text.
- **D-05: Loom preserved.** Loom remains a first-class manual source via `source_app: "loom"` and `loom.com/share/` URL detection.
- **D-06: Markdown is transcript text.** Markdown `.md` is not document ingestion. It is accepted as manual transcript text, preserved in `full_transcript`, and parsed only when it matches known speaker/timestamp patterns.

## Supported Manual Import Formats

When users import a transcript, CallVault automatically detects and routes it to the appropriate parser. Phase 1 does not expose audio/video upload or asynchronous transcription as a user-facing manual import behavior.

### 1. Zoom VTT (`zoom`)
- **Detection**: The raw text begins with `WEBVTT` or the provided Source URL contains `zoom.us`.
- **Parsing**: Standard WebVTT parsing using `vtt-parser.ts`. Extracts timestamps, speakers (if embedded in cues), and text.

### 2. SubRip Subtitle (`srt`)
- **Detection**: The text begins with a numeric sequence followed by an SRT timestamp line (e.g., `00:00:01,000 --> 00:00:04,000`).
- **Parsing**: Extracts `start_ms` from timestamps. Since SRT natively lacks speaker attributions, the speaker defaults to `Unknown Speaker` unless a convention like `Speaker Name: text` is used inside the subtitle text. Uses `srt-parser.ts`.

### 3. Otter.ai Text Export (`otter`)
- **Detection**: The text contains Otter.ai export branding or dense `Speaker Name: text body` turns without VTT/SRT timestamp markers.
- **Parsing**: Extracts speakers and text from `Speaker Name: text body` turns. Otter TXT imports do not carry reliable turn timestamps, so CallVault preserves turn order with sequential offsets. Uses `otter-parser.ts`.

### 4. Fathom Copy Format (`fathom-paste`)
- **Detection**: Contains at least two lines matching Fathom's "Copy Transcript" button output formats (e.g., `Alice (0:00) Hello` or `0:00 - Alice\nHello`).
- **Parsing**: Parses various Fathom timestamp+speaker patterns. Extracts title, date, and attendees from the free-form header if present. Uses `fathom-transcript-parser.ts`.

### 5. Loom (`loom`)
- **Detection**: The provided Source URL contains `loom.com/share/`.
- **Parsing**: Extracts timestamps (e.g., `0:00` or `00:05` on a single line) and the corresponding text. Loom often lacks speaker names, so missing speakers are emitted as `Unknown Speaker`. Uses `loom-parser.ts`.

### 6. Markdown (`.md`)
- **Detection**: The browser accepts `.md` transcript files as text inputs. The backend treats their contents like any other manual transcript text.
- **Parsing**: Markdown is preserved in `full_transcript`. It is parsed into turns only if the text also matches known transcript patterns such as Fathom speaker+timestamp lines, VTT cues, SRT cues, or Otter-style speaker turns.

### 7. Raw / Fallback
- **Detection**: If no format heuristics match, or if a parser detects 0 valid trusted segments.
- **Parsing**: The parser returns `{ parse_status: "raw", segments: [] }`. The raw text is saved directly to `full_transcript`, and `transcript_segments` is set to `null`. The UI displays the raw text natively to prevent data loss.

## Threat Model & Security

1. **Pure TypeScript Utilities**: All parsers in `_shared` are pure TS without runtime dependencies (no `Deno.*`, no external packages). This allows them to run safely in Edge Functions and the Vite frontend.
2. **Read-Only Processing**: Parsers perform strictly read-only text processing (regex matching and string manipulation). There are no `eval` calls or external fetch requests during parsing.
3. **Graceful Degradation**: If a format changes or is malformed, the system falls back to saving the raw text in `full_transcript` rather than throwing a hard error, ensuring zero data loss for users.
