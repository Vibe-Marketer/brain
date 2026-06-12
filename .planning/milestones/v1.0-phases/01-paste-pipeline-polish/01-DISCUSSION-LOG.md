# Phase 1: Paste Pipeline Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 01-Paste Pipeline Polish
**Areas discussed:** Format parsing boundaries, File-upload removal line

---

## Format Parsing Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Save raw fallback whenever possible | If VTT/SRT/Otter detection is weak or parsing yields no turns, save the raw transcript and mark `parse_status: raw`, so the user never loses content. | ✓ |
| Strict fail for selected structured formats | If the user selected VTT/SRT/Otter and parsing fails, show a friendly error and do not save until they fix the file. | |
| Hybrid | Auto-detected formats fall back to raw, but explicitly selected VTT/SRT/Otter fails if invalid. | |

**User's choice:** Save raw whenever possible, with the caveat that CallVault should attempt to parse whatever it can first.
**Notes:** Best-effort parse plus no data loss is the governing rule.

| Option | Description | Selected |
|--------|-------------|----------|
| Use detected labels only, otherwise `Unknown Speaker` | Preserves accuracy and avoids inventing participants. SRT/Otter/VTT can still use labels like `Alice: text` when present. | ✓ |
| Infer speakers aggressively from attendee/title/header text | More polished when it guesses right, but can misattribute transcript turns. | |
| Collapse speakerless text into plain transcript segments | Avoids `Unknown Speaker`, but loses turn-level structure in the detail UI. | |

**User's choice:** Use detected labels only.
**Notes:** Do not infer speakers aggressively.

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve real timestamps when present, sequential offsets when missing | VTT/SRT keep cue timestamps. Otter TXT or speaker-only text gets stable offsets like turn index * 1000ms so turn order works. | ✓ |
| Require timestamps for structured segments | If a format lacks reliable timing, save as raw instead of creating segments. | |
| Use `0` for all missing timestamps | Simpler, but downstream ordering and transcript navigation can behave poorly. | |

**User's choice:** Preserve real timestamps, use sequential offsets, and fall back to `0` if needed.
**Notes:** Sequential offsets are preferred over all-zero timestamps.

| Option | Description | Selected |
|--------|-------------|----------|
| VTT, SRT, Otter TXT, Fathom copy, raw text | Matches the roadmap and current paste-focused scope; keeps Phase 1 tight. | |
| Add Loom if already present in code | The code has Loom parsing hooks, but Loom is not in Phase 1 requirements. Include only if documented/tested as part of this phase. | ✓ |
| Broader common transcript files | Includes TXT variants beyond Otter, maybe CSV/DOCX/PDF later. This likely becomes new scope. | |

**User's choice:** Include Loom, VTT, SRT, Otter TXT, Fathom copy, raw text, and `.md`.
**Notes:** User said Loom should already be implemented by past agents. Planning should verify and preserve existing Loom support.

---

## File-Upload Removal Line

| Option | Description | Selected |
|--------|-------------|----------|
| Remove audio/video upload entry points only | Hide `FileUploadDropzone`, File Upload source cards, onboarding upload cues, and audio/video upload copy. Keep transcript file upload inside the paste modal for `.vtt`, `.srt`, `.txt`, `.md`. | ✓ |
| Remove all file-picking UI | Pure paste-only textarea. Cleaner scope, but worse for users with exported transcript files. | |
| Keep a disabled File Upload card with coming-in-v2 copy | Makes future intent visible, but creates a dead end during self-serve launch. | |

**User's choice:** Remove audio/video upload entry points only.
**Notes:** Transcript file selection remains part of manual transcript import.

| Option | Description | Selected |
|--------|-------------|----------|
| Hide from user-facing import/onboarding surfaces, preserve internal metadata | Keep `file-upload` types/adapter/backend compatibility for old rows and in-flight callers, but do not show it as a selectable import source. | ✓ |
| Remove from registries wherever possible | Cleaner UI/model, but higher risk because existing recordings and source labels may still depend on `file-upload`. | |
| Leave the source visible but route users to paste transcript | Less code churn, but confusing because File Upload implies audio/video transcription still exists. | |

**User's choice:** Hide user-facing surfaces and preserve compatibility for now.
**Notes:** User doubts real manual uploads exist. Planning should verify before deleting compatibility code.

| Option | Description | Selected |
|--------|-------------|----------|
| Route to Save Transcript / paste modal | Anywhere the user would have been nudged to upload audio/video, show the paste/manual transcript path instead. | |
| Remove the CTA entirely | Cleaner, but some empty states may become less actionable. | ✓ |
| Connector-first replacement | Push users toward Fathom/Zoom/etc. instead of manual import. Better for product story, but less direct for someone with a transcript in hand. | |

**User's choice:** Remove all upload stuff entirely.
**Notes:** The replacement concept is manual transcript import, not another upload CTA. User suggested renaming Paste/Save Transcript to align with normal product language.

| Option | Description | Selected |
|--------|-------------|----------|
| Import Transcript | Broad enough for paste, transcript files, Markdown, Loom/Fathom links, and raw text. Does not imply audio/video upload. | ✓ |
| Add Transcript | Friendly and simple, but less explicit that it is an import flow. | |
| Save Transcript | Matches current UI, but sounds more like saving something already inside CallVault than importing from elsewhere. | |
| Manual Import | Accurate internally, but more technical and less user-facing. | |

**User's choice:** Import Transcript.
**Notes:** User also wants the main Import sidebar label reconsidered for clarity and industry-standard language. This is noted as a deferred/sidebar-copy consideration.

---

## Agent's Discretion

- Exact weak-format parser thresholds.
- Exact friendly error copy.
- Exact compatibility verification method for existing `file-upload` rows.

## Deferred Ideas

- Consider renaming the main `Import` sidebar/nav concept if it is naturally touched by Phase 1 import-surface copy work; otherwise defer to launch UX/navigation polish.
- Audio/video file upload and async transcription remain v2 scope.
