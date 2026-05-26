# Requirements: CallVault YouTube Vault

**Defined:** 2026-05-26
**Core Value:** YouTube videos are public content with rich metadata and deserve a dedicated schema, thumbnail-first UI, and isolated vault type.

## v1 Requirements

Requirements for the YouTube Vault release. Each maps to roadmap phases.

### Data Model & Schema

- [ ] **SCHM-01**: Support 'youtube' type in `vaults.vault_type` enum constraint and Typescript types
- [ ] **SCHM-02**: Create `youtube_videos` table with metadata fields (views, subscriber count, likes, duration, thumbnails, outlier indicators, transcript)
- [ ] **SCHM-03**: Implement row-level security (RLS) policies on `youtube_videos` table for workspace boundary segregation

### Ingestion

- [ ] **ING-01**: Update `youtube-import` edge function to fetch all statistics and snippet details from YouTube API
- [ ] **ING-02**: Ensure edge function writes video data into `youtube_videos` table instead of `recordings`
- [ ] **ING-03**: Implement duplicate detection to reject double imports per workspace
- [ ] **ING-04**: Auto-create a default YouTube vault for the user if none exists during import

### API Hooks

- [ ] **HOOK-01**: Implement `useYouTubeVideos` React Query hook to list and filter videos in a vault
- [ ] **HOOK-02**: Implement `useYouTubeVideo` React Query hook to fetch detailed video transcript and metadata
- [ ] **HOOK-03**: Implement search capabilities (full-text database search) in the hooks layer

### User Interface

- [ ] **UI-01**: Create `YouTubeVideoTable` card-based and row-based list component displaying video thumbnails and stats
- [ ] **UI-02**: Create `YouTubeVideoDetail` panel (pane 4) displaying large thumbnails, descriptions, stats, and metadata
- [ ] **UI-03**: Implement YouTube filter tabs ("All" | "Calls" | "YouTube") on the main Vaults page
- [ ] **UI-04**: Update `YouTubeImportForm` to scope inputs to YouTube vaults only

### AI Chat Integration

- [ ] **CHAT-01**: Wire AI chat panel within video detail to stream answers citing the video transcript
- [ ] **CHAT-02**: Support youtube_videos search within AI tools (`getYouTubeVideoDetails`, `searchYouTubeVideos`)

## v2 Requirements

Deferred to future releases.

### Advanced Features

- **PLAY-01**: Embedded video player in detail panel (watch directly in CallVault)
- **PLAY-02**: Sync whole YouTube playlists or channels automatically
- **ANLY-01**: Implement actual outlier score calculations instead of simple placeholders

## Out of Scope

| Feature | Reason |
|---------|--------|
| YouTube upload | CallVault is an ingestion/analysis tool, not a publisher |
| Video file downloads | High bandwidth/storage costs; streaming from YouTube suffices |
| Comments content sync | Large data payload with low analysis value (count is sufficient) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHM-01 | Phase 1 | Pending |
| SCHM-02 | Phase 1 | Pending |
| SCHM-03 | Phase 1 | Pending |
| ING-01 | Phase 1 | Pending |
| ING-02 | Phase 1 | Pending |
| ING-03 | Phase 1 | Pending |
| ING-04 | Phase 1 | Pending |
| HOOK-01 | Phase 2 | Pending |
| HOOK-02 | Phase 2 | Pending |
| HOOK-03 | Phase 2 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| CHAT-01 | Phase 3 | Pending |
| CHAT-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-05-26 after initial definition*
