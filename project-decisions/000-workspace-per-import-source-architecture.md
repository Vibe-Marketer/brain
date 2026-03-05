# Workspace-Per-Import-Source Architecture

**Type:** System architecture directive
**Status:** Decision locked
**Date:** 2026-03-02
**Supersedes:** Any prior assumptions about a single shared table for all import types

---

## Problem Statement

The current architecture tries to display all import types (Fathom, Zoom, YouTube, file uploads, etc.) in a single "main" table (`TranscriptTable.tsx`). That table was designed for Fathom's specific schema (participants, invitees, Fathom-specific metadata). This creates two problems:

1. **Schema mismatch.** YouTube imports don't have invitees. Zoom imports don't have channel info. Forcing all types into one table means columns are either empty or irrelevant for non-Fathom records.
2. **Future brittleness.** Every new import type (Fireflies, tl;dv, Grain, audio recordings) would further pollute the shared table with source-specific columns that only apply to a fraction of rows.

---

## What Already Exists and MUST Be Preserved

Before reading any architecture rules, understand this: two components have had significant time, energy, and thought invested. They are NOT to be deleted, rewritten, or degraded. Everything in this document builds on top of them.

| Component | Current Location | What It Is |
|-----------|-----------------|------------|
| `TranscriptTable.tsx` | `src/components/transcript-library/TranscriptTable.tsx` | The main call table — its styling, two-level row structure, spacing, and density are the gold standard |
| `CallDetailDialog.tsx` | `src/components/CallDetailDialog.tsx` | The call detail modal — its layout, tabs, popup behavior, and UX are the template for all call types |

**What happens to them going forward:**

| Component | Current Role | Future Role |
|-----------|-------------|-------------|
| `TranscriptTable.tsx` | Used as the main/primary table for all calls | Renamed/refactored to become the **Fathom-specific** table. Used ONLY in the Fathom workspace. |
| `CallDetailDialog.tsx` | Used as the call detail modal | Becomes the **base modal component**. The current configuration (with Fathom tabs) becomes the Fathom variant. Other source types add their own tab configurations. |

Both were built with Fathom in mind. They remain the Fathom implementation AND the quality benchmark everything else is measured against.

---

## Workspace Architecture

### Rule 1 — Every import source gets its own dedicated workspace (NON-NEGOTIABLE)

When a user connects a new import source, the system automatically creates a workspace for that source. This is not optional.

| Import Source | Auto-Created Workspace |
|---------------|----------------------|
| Fathom | "Fathom" workspace |
| Zoom | "Zoom" workspace |
| YouTube | "YouTube" workspace |
| Fireflies | "Fireflies" workspace |
| tl;dv | "tl;dv" workspace |
| File Upload (audio/video) | "Uploads" workspace (single workspace for both — see Rule 2) |

No import type shares a primary data table with another import type.

### Rule 2 — Audio and video uploads share one "Uploads" workspace

Audio and video file uploads use a single "Uploads" workspace with one shared table schema. Their schemas are identical — the only difference is whether a record has a video file or just audio.

Each upload record stores a `media_type` field (`'audio' | 'video'`). This determines what the modal renders:
- Video upload: video player in the "View" tab
- Audio upload: audio player in the "View" tab

Everything else is identical for both: transcript, speaker diarization, summary, token count, edit, share, copy, export.

### Rule 3 — Source workspaces are renamable (original name always preserved)

Users can rename any source workspace (e.g., rename "Fathom" to "Client Calls" or "Team Meetings"). When renamed:

- The `display_name` field stores the user-chosen name and is shown as the primary label
- The original source name (e.g., "Fathom") is always preserved and displayed as a subtle subtitle beneath the display name
- If the user has not set a custom name, the original source name is the primary label with no subtitle

This means the system always knows what source type a workspace represents, regardless of what the user calls it.

### Rule 4 — Source workspaces can be hidden, not deleted

Source workspaces cannot be deleted. They can only be **hidden**.

- **Hidden** = removed from the sidebar, not visible in navigation, data fully preserved
- **Unhiding** = workspace reappears exactly as it was, all data intact
- **Individual call deletion** = supported, same as current behavior
- **Bulk call deletion** = supported (delete all calls in the workspace)
- **Workspace deletion** = NOT supported for source workspaces. The workspace persists as long as the account exists.

Rationale: If a user disconnects a source and later reconnects, the workspace is already there with any remaining data. No orphaned records, no re-creation logic, no "where did my data go" confusion.

---

## Table Architecture

### Rule 5 — Each source workspace has a source-optimized table

The table displayed inside a source workspace is custom-designed for that source's schema. It shows ALL metadata relevant to that source.

**Fathom workspace table** includes: participants, invitees, duration, meeting platform, Fathom-specific metadata, etc. This is the current `TranscriptTable.tsx` — it stays exactly as-is but becomes Fathom-specific.

**YouTube workspace table** includes: title, channel name, views, description, outlier ranking, video-specific metadata, etc.

**Zoom workspace table** includes: meeting ID, host, participants, duration, Zoom-specific metadata, etc.

Each source table is designed at the time the import type is built. The Fathom table is the gold standard for quality and density — all other source tables should match its level of polish and information density, adapted for their own schema.

### Rule 6 — Table design inspiration hierarchy

For import types similar to Fathom (meeting platforms like Zoom, Fireflies, tl;dv, Grain):
- Use `TranscriptTable.tsx` as a direct template
- Match the styling, spacing, two-level row structure, and density
- Adapt columns for the specific source's schema

For import types that are fundamentally different (YouTube, audio recordings, video files):
- Use `TranscriptTable.tsx` as inspiration for quality and polish
- The table structure may differ significantly to serve the content type
- Still maintain consistent CallVault visual language (same fonts, colors, spacing rhythm)

### Rule 7 — "All Calls" workspace uses a universal table (DIFFERENT from source tables)

There must be an "All Calls" workspace that aggregates records from every source. This workspace uses a simplified universal table that shows ONLY fields common to all import types:

| Universal Field | Description |
|----------------|-------------|
| Title | Call/video/recording title |
| Date | When it occurred |
| Duration | Length of the recording |
| Source | Import type badge (Fathom, YouTube, Zoom, etc.) |
| Summary | AI-generated or source-provided summary |
| Created at | When it was imported |

The "All Calls" table intentionally excludes source-specific metadata. No participants column (Fathom-only). No channel info column (YouTube-only). No Zoom meeting ID column.

### Rule 8 — User-created workspaces ALWAYS use the universal table schema

When a user manually creates a workspace (for organizing, sharing, inviting collaborators), that workspace ALWAYS uses the universal table schema — identical to the "All Calls" table.

There is NO option to use a source-specific table schema in a user-created workspace. Source-specific tables are ONLY visible in the auto-created source workspace. This is non-negotiable.

**The hierarchy is:**
- Source workspaces (auto-created) = source-optimized table
- "All Calls" workspace = universal table
- User-created workspaces = universal table (same schema as "All Calls")

### Rule 9 — Data movement preserves the original record

When a call appears in "All Calls" or any user-created workspace:
- It references the original record in the source workspace. No duplication.
- Only universal fields are displayed in the table view.
- The original source-specific schema remains intact on the underlying record.
- Moving or copying a record to another workspace does NOT strip metadata — it only changes which fields are visible in that workspace's table.

---

## Call Detail Modal Architecture

### Rule 10 — One modal component, dynamically configured per source type

The call detail modal (`CallDetailDialog.tsx`) is the popup that appears when you click any call in any table. This component:

- Is the SAME component everywhere (source tables, "All Calls", user-created workspaces)
- Opens in the SAME way (same slide-in/popup behavior, same position, same size)
- Has the SAME base layout and structure
- Is dynamically configured based on the import source type of the clicked record

Clicking a Fathom call in the "All Calls" table opens the Fathom-configured modal. Clicking a YouTube call in the same table opens the YouTube-configured modal. The table schema is universal, but the modal is always source-aware.

### Rule 11 — Universal modal features (ALWAYS present for all source types)

These features must exist in the modal for every import type, no exceptions:

| Feature | Description |
|---------|-------------|
| View | Link to original source (Fathom recording, YouTube video, Zoom recording, etc.) |
| Copy | Copy transcript or content |
| Share | Share the record |
| Edit | Edit title, transcript, notes |
| Export | Download/export the record |
| Summary section | AI-generated or source-provided summary |
| Transcript | Full transcript with speaker bubbles (blue/white), if transcript exists |
| Token/word/character count | Stats displayed at the bottom of the transcript, if applicable |

The transcript viewer must use the same UI format across all sources: the existing blue and white speaker bubbles, full scrollable view, export capability.

**Exception for Uploads:** Unlike other import types where "View" links out to the original source (Fathom recording page, YouTube video, Zoom cloud recording), the Uploads modal has a **"View" tab** where the user plays the media directly inside CallVault. This is the one source type where the content lives inside the app, not externally.

### Rule 12 — Tabs are dynamic per source type

The tabs shown in the modal change based on the import source. The modal component renders different tab configurations, not different modal components.

**Fathom modal tabs:**
- Overview
- Transcript
- Invitees
- Participants

**YouTube modal tabs:**
- Overview (summary + original description)
- Transcript (if available)
- Channel Info
- Engagement Metrics (views, likes, etc.)

**Zoom modal tabs:**
- Overview
- Transcript
- Participants

**Uploads modal tabs:**
- View (embedded video or audio player)
- Overview (summary, file metadata)
- Transcript

**Other source types:** Tabs are designed when the import type is built, following the same pattern. Every source must have at least Overview and Transcript (if transcript data exists).

---

## Implementation Checklist

### Rule 13 — When adding a new import type, you MUST:

1. Create a dedicated workspace for that source (auto-created on connection)
2. Design a source-optimized table component for that workspace
3. Ensure compatibility with the universal "All Calls" table schema
4. Configure the call detail modal tabs and layout for that source type
5. Ensure all universal modal features (Rule 11) are present

---

## What This Changes From Previous Decisions

- Phase 16 (workspace redesign) established the workspace/folder hierarchy. This decision adds the rule that import sources auto-create their own workspaces within that hierarchy.
- Phase 17 (import connector pipeline) built the shared connector pipeline. This decision adds that each connector's output lands in a source-specific workspace with a source-specific table.
- Phase 18 (routing rules) routes calls to workspaces/folders. This decision clarifies that routing targets user-created workspaces (universal table) while the source workspace always retains the original with full metadata.
