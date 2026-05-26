# CallVault - YouTube Vault

## What This Is

Create a dedicated **YouTube Vault** system that separates YouTube video imports from call transcripts. YouTube videos have distinct metadata (views, likes, comments, channel info) and deserve their own specialized UI that supports thumbnails and video-specific analytics.

## Core Value

YouTube videos are fundamentally different from calls - they're public content with engagement metrics, not private conversations. They need their own vault type, table schema, and UI optimized for video content.

## Requirements

### Validated

- ✓ **Unified Connector Registry:** Every current connector has a registered adapter in `src/components/connectors/registry/` — connector-unification
- ✓ **Unified Setup UI:** settings, onboarding (`/setup`), and import pages use the unified `<ConnectorSetupCluster>` UI and `useConnector` hook — connector-unification
- ✓ **Bulk Backfill:** Every recording-source connector can backfill historical recordings in bulk — connector-unification
- ✓ **Future Ingestion:** Every recording-source connector supports future ingestion through webhook or polling when the provider makes it possible — connector-unification
- ✓ **Payload Normalization:** Every connector maps provider payloads into the shared canonical recording shape before insertion — connector-unification
- ✓ **Source-Agnostic Core:** Downstream UI, MCP tools, title/tag/summary actions, search, and exports remain source-agnostic — connector-unification

### Active

- [ ] **US-001: Create youtube vault type** — Add 'youtube' to vault_type CHECK constraint, update typescript types.
- [ ] **US-002: Create youtube_videos table schema** — Create table with all metadata columns, RLS policies, indexes, and full-text search.
- [ ] **US-003: Update youtube-import edge function for new schema** — Modify edge function to populate youtube_videos table with views, likes, comments, subscriber count, and thumbnails.
- [ ] **US-004: Create useYouTubeVideos hook** — React Query hooks for fetching, filtering, and searching YouTube videos.
- [ ] **US-005: Create YouTubeVideoTable component** — Card-based/row-based UI component optimized for large thumbnails and engagement metrics.
- [ ] **US-006: Create YouTubeVideoDetail panel** — Detail panel (pane 4) displaying large thumbnails, descriptions, stats, and a transcript AI chat interface.
- [ ] **US-007: Add YouTube vault filter to Vaults page** — Update page with filter tabs ("All" | "Calls" | "YouTube") and conditional tables.
- [ ] **US-008: Wire AI chat to youtube_videos transcript** — Configure chat stream backend/tools to query video transcripts for cited answers.
- [ ] **US-009: Create YouTube vault selector in import form** — Filter VaultSelector in import forms to show only YouTube vaults, with default auto-creation.
- [ ] **US-010: Add YouTube analytics foundation** — Prepare database and UI skeleton for outlier score and outlier rank metrics.

### Out of Scope

- **YouTube upload** — Import-only MVP, no publishing videos back to YouTube.
- **Playlist import** — Single videos only, no playlist importing support.
- **Channel subscription sync** — No automatic syncing/importing of new videos from subscribed channels.
- **Video download** — Stream directly from YouTube/embeds, no local video file storage.
- **Sidebar navigation** — Main navigation is through the Vaults filtering; dedicated sidebar item is deferred.
- **Outlier Rank calculation** — Schema fields and UI placeholders only; the rank algorithm is deferred.
- **Video player** — Direct link to watch on YouTube; embedded player is deferred.
- **Comments import** — Store total comment count only, not actual comments content.
- **Multi-language transcripts** — One primary transcript per video.
- **Live streams** — Support for regular uploaded videos only, no live streams.

## Context

CallVault is transitioning from v1 to v2. The codebase currently contains a unified connector registry and settings UI. YouTube imports currently flow into the regular recordings table; this project extracts them into a dedicated schema and layout.

## Constraints

- **Stack**: React 18, Vite 5, TailwindCSS, Supabase PostgreSQL, Zustand.
- **Icons**: Remix Icons (`@remixicon/react`) ONLY. No Lucide or FontAwesome.
- **AI-02**: Zero AI/RAG/embedding code in the frontend (must live in Edge Functions).
- **No AI label**: Never use "AI-powered" positively in UI copy; brand is "AI-ready".

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dedicated `youtube_videos` table | YouTube metadata (views, subscribers, likes) is highly distinct from standard call transcripts and would pollute the general `recordings` table. | ✓ Good |

---
*Last updated: 2026-05-26 after planning reset*
