# Roadmap: CallVault YouTube Vault

## Overview

This roadmap lays out the path to transition YouTube imports into a dedicated YouTube Vault. It moves in four structured phases: establishing the database schema and backend ingestion functions, building the custom UI components, integrating the layout filters and AI chat functionalities, and polishing the final analytics hooks.

## Milestones

- 🚧 **v2.2 YouTube Vault** - Phases 1-4 (in progress)

## Phases

- [ ] **Phase 1: Backend & Ingestion Foundation** - Database schema, migrations, RLS policies, and youtube-import edge function updates.
- [ ] **Phase 2: Hooks & UI Components** - React Query hooks, YouTubeVideoTable, and YouTubeVideoDetail pane.
- [ ] **Phase 3: Integration & AI Chat** - Vaults page filtering, YouTubeImportForm updates, and AI transcript chat streaming.
- [ ] **Phase 4: Polish & Analytics** - Outlier rank UI badges and final E2E verification.

## Phase Details

### Phase 1: Backend & Ingestion Foundation
**Goal**: Establish the DB schema, table indexes, RLS policies, and modify the `youtube-import` edge function to target `youtube_videos`.
**Depends on**: Nothing
**Requirements**: SCHM-01, SCHM-02, SCHM-03, ING-01, ING-02, ING-03, ING-04
**Success Criteria**:
  1. The vaults table permits inserting 'youtube' vault types.
  2. The `youtube_videos` table exists with proper types, indexes, and Full-Text Search.
  3. Edge function fetches subscriber counts, view/like/comment counts, and thumbnail URLs.
  4. Row-level security restricts SELECT/INSERT calls strictly to active organization boundaries.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Vault type enum expansion migration
- [ ] 01-02: Create `youtube_videos` table schema and RLS policies migration
- [ ] 01-03: Update `youtube-import` edge function and auto-vault creation

### Phase 2: Hooks & UI Components
**Goal**: Build the data fetching layer hooks and core video-centric UI views (table rows, detail panel layout).
**Depends on**: Phase 1
**Requirements**: HOOK-01, HOOK-02, HOOK-03, UI-01, UI-02
**Success Criteria**:
  1. Hooks support fetching, sorting, and full-text searching video resources.
  2. YouTubeVideoTable displays thumbnail previews, channel details, and engagement stats.
  3. YouTubeVideoDetail displays large thumbnails, description summaries, and metadata metrics.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Implement `useYouTubeVideos` and `useYouTubeVideo` React Query hooks
- [ ] 02-02: Build `YouTubeVideoTable` and `YouTubeVideoRow` UI components
- [ ] 02-03: Build `YouTubeVideoDetail` panel component layout (pane 4)

### Phase 3: Integration & AI Chat
**Goal**: Connect the components to the main Vaults page, update import workflows, and wire the AI chat engine to video transcripts.
**Depends on**: Phase 2
**Requirements**: UI-03, UI-04, CHAT-01, CHAT-02
**Success Criteria**:
  1. Tabs on Vaults page correctly filter by Mixed, Calls, and YouTube vault collections.
  2. Importing a video URL scopes it directly into the user's selected YouTube vault.
  3. The detail panel AI chat panel sends requests to video transcript contexts and retrieves citations.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Implement tabbed vaults filtering and conditional view rendering
- [ ] 03-02: Update `YouTubeImportForm` layout and hooks
- [ ] 03-03: Wire video transcript citations and AI chat backend tooling

### Phase 4: Polish & Analytics
**Goal**: Add analytics field skeletons and execute validation tests.
**Depends on**: Phase 3
**Requirements**: (None, Polish phase)
**Success Criteria**:
  1. Outlier rank and score columns exist.
  2. UI displays "Coming Soon" badges for outlier indicators.
  3. All TypeScript compile checks and Playwright tests pass successfully.
**Plans**: 1 plan

Plans:
- [ ] 04-01: Add Outlier Rank placeholders and run E2E test validations

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend & Ingestion | v2.2 | 0/3 | Not started | - |
| 2. Hooks & UI Components | v2.2 | 0/3 | Not started | - |
| 3. Integration & AI Chat | v2.2 | 0/3 | Not started | - |
| 4. Polish & Analytics | v2.2 | 0/1 | Not started | - |

---
*Roadmap defined: 2026-05-26*
*Last updated: 2026-05-26 after initial definition*
