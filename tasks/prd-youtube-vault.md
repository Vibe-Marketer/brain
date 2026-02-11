# PRD: YouTube Vault - Dedicated Video Content Management

## Overview

Create a dedicated **YouTube Vault** system that separates YouTube video imports from call transcripts. YouTube videos have distinct metadata (views, likes, comments, channel info) and deserve their own specialized UI that supports thumbnails and video-specific analytics.

**Key Principle:** YouTube videos are fundamentally different from calls - they're public content with engagement metrics, not private conversations. They need their own vault type, table schema, and UI optimized for video content.

---

## Goals

1. **Separate Content Types:** YouTube videos live in `youtube` vault type, completely separate from `personal`/`team` transcript vaults
2. **Rich Video Metadata:** Store and display YouTube-specific data (views, likes, comments, channel info, thumbnails)
3. **Thumbnail-First UI:** Custom YouTube-style table that prominently displays video thumbnails
4. **Unified AI Chat:** Users can chat with YouTube video transcripts exactly like they do with calls (with citations)
5. **Future Analytics Foundation:** Schema supports "Outlier Rank" feature (coming soon) for identifying high-performing videos
6. **Vault-Aware Navigation:** Filter within existing Vaults page; dedicated sidebar nav deferred to future phase

---

## User Stories

### US-001: Create youtube vault type
**Description:** As a developer, I need a distinct vault type for YouTube videos so they're properly segmented from call transcripts.

**Acceptance Criteria:**
- [ ] Add 'youtube' to vault_type CHECK constraint in vaults table
- [ ] Migration to handle existing data (if any)
- [ ] Types updated: VaultType = 'personal' | 'team' | 'coach' | 'community' | 'client' | 'youtube'
- [ ] npm run typecheck passes

### US-002: Create youtube_videos table schema
**Description:** As a developer, I need a dedicated table for YouTube videos with full metadata support.

**Acceptance Criteria:**
- [ ] Migration: `20260211_create_youtube_videos_table.sql`
- [ ] Table columns:
  - `id` (UUID, PK)
  - `vault_id` (UUID, FK to vaults)
  - `bank_id` (UUID, FK to banks) - for workspace scoping
  - `user_id` (UUID, FK to auth.users)
  - `youtube_video_id` (TEXT, unique per video)
  - `title` (TEXT)
  - `channel_name` (TEXT)
  - `channel_subscriber_count` (BIGINT, nullable)
  - `thumbnail_url` (TEXT)
  - `thumbnail_width` (INTEGER)
  - `thumbnail_height` (INTEGER)
  - `duration_seconds` (INTEGER)
  - `view_count` (BIGINT)
  - `like_count` (BIGINT)
  - `comment_count` (BIGINT)
  - `published_at` (TIMESTAMPTZ)
  - `category` (TEXT, nullable)
  - `description` (TEXT)
  - `outlier_rank` (INTEGER, nullable) - for future feature
  - `outlier_score` (DECIMAL, nullable) - for future feature
  - `transcript` (TEXT) - full transcript for AI chat
  - `transcript_language` (TEXT)
  - `source_url` (TEXT) - original YouTube URL
  - `imported_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- [ ] Indexes: youtube_video_id (unique), vault_id, bank_id, channel_name, view_count, outlier_rank
- [ ] RLS policies for workspace-scoped access
- [ ] Full-text search index on title, description, transcript
- [ ] npm run typecheck passes

### US-003: Update youtube-import edge function for new schema
**Description:** As a developer, I need the import function to populate the new youtube_videos table with full metadata.

**Acceptance Criteria:**
- [ ] Modify `supabase/functions/youtube-import/index.ts`:
  - Accept `vault_id` in request body (must be youtube-type vault)
  - Fetch ALL metadata from YouTube API: snippet (title, channel, published, category, description, thumbnails), statistics (views, likes, comments), contentDetails (duration)
  - Store video in `youtube_videos` table (not recordings table)
  - Handle channel subscriber count (may need separate API call)
- [ ] Create youtube-type vault automatically if user doesn't have one
- [ ] Validation: Reject import to non-youtube vault types
- [ ] Return full video object in response
- [ ] npm run typecheck passes

### US-004: Create useYouTubeVideos hook
**Description:** As a developer, I need a hook to fetch and manage YouTube videos within a vault.

**Acceptance Criteria:**
- [ ] Create `src/hooks/useYouTubeVideos.ts`:
  - `useYouTubeVideos(vaultId: string)` - fetch videos for a vault
  - `useYouTubeVideo(videoId: string)` - fetch single video with transcript
  - `useCreateYouTubeVault()` - auto-create youtube vault if needed
  - Sorting: views, likes, comments, published_at, duration, outlier_rank
  - Filtering: channel_name, category, date range
  - Search: full-text on title, description, transcript
- [ ] React Query integration with proper cache keys
- [ ] npm run typecheck passes

### US-005: Create YouTubeVideoTable component
**Description:** As a user, I want to see YouTube videos in a clean, thumbnail-first list with all relevant metadata.

**Acceptance Criteria:**
- [ ] Create `src/components/youtube/YouTubeVideoTable.tsx`:
  - **Layout:** Card-based or row-based with large thumbnails (120x90px or 160x90px)
  - **Columns:**
    - Thumbnail (leftmost, clickable to open detail)
    - Title + Channel name (with subscriber count)
    - Published "X time ago"
    - Duration
    - Views (formatted: 1.2M, 450K)
    - Likes (formatted)
    - Comments (formatted)
    - Category (badge)
    - Outlier Rank (coming soon badge if null)
  - **Row design:** 
    - Thumbnail on left
    - Title + channel stacked
    - Stats row: views • likes • comments
    - Published date as secondary info
  - Sortable by all numeric columns
  - Responsive: Stack on mobile, horizontal on desktop
- [ ] Create `src/components/youtube/YouTubeVideoRow.tsx` for individual rows
- [ ] Hover effects: Thumbnail zoom, row highlight
- [ ] Click handler to open video detail panel
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Create YouTubeVideoDetail panel
**Description:** As a user, I want to view video details and chat with the transcript exactly like I do with calls.

**Acceptance Criteria:**
- [ ] Create `src/components/youtube/YouTubeVideoDetail.tsx` (pane 4 component):
  - Video thumbnail (large, 320px width)
  - Title (prominent)
  - Channel info with subscriber count
  - Stats row: Views | Likes | Comments | Published
  - Category badge
  - Description (expandable/collapsible, max 3 lines initially)
  - "Watch on YouTube" external link button
  - **AI Chat Interface:**
    - Same chat component as CallDetailPanel
    - System prompt optimized for video content analysis
    - Citations work exactly like call transcripts
    - Message history stored per video
  - Metadata section (collapsible):
    - Video ID
    - Duration
    - Language
    - Imported date
    - Outlier rank (or "Coming Soon" badge)
- [ ] Integration with existing chat infrastructure
- [ ] Proper loading and error states
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Add YouTube vault filter to Vaults page
**Description:** As a user, I want to filter my vaults to see only YouTube vaults and their videos.

**Acceptance Criteria:**
- [ ] Update Vaults page (`src/pages/Vaults.tsx`):
  - Add vault type filter tabs: "All" | "Calls" | "YouTube"
  - "Calls" = personal/team/coach/community/client vaults
  - "YouTube" = youtube vaults only
  - Persist filter in URL params (?type=youtube)
- [ ] When YouTube vault selected:
  - Show YouTubeVideoTable instead of TranscriptTable
  - Show YouTube-specific columns in vault header
  - Hide call-specific filters (participants, meeting date, etc.)
- [ ] Empty state for YouTube vault: "Import your first YouTube video" with CTA button
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Wire AI chat to youtube_videos transcript
**Description:** As a user, I want to ask questions about YouTube video content and get cited answers.

**Acceptance Criteria:**
- [ ] Create `chat-stream-youtube` edge function (or extend existing):
  - Accept youtube_video_id as context
  - Query transcript from youtube_videos table
  - Use same RAG pipeline as call transcripts
  - Citations reference video segments (timestamp-based if available)
- [ ] Update chat tools to support youtube_video source:
  - Tool: `getYouTubeVideoDetails`
  - Tool: `searchYouTubeVideos` (within vault scope)
- [ ] Frontend chat component works with YouTube videos
- [ ] npm run typecheck passes

### US-009: Create YouTube vault selector in import form
**Description:** As a user, I want to select which YouTube vault to import into.

**Acceptance Criteria:**
- [ ] Update `YouTubeImportForm`:
  - VaultSelector filtered to show only youtube-type vaults
  - Auto-create "My YouTube Videos" vault if none exists
  - Show vault thumbnail/list preview
- [ ] Pre-select default YouTube vault per user
- [ ] Error handling: Cannot import to call vault
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Add YouTube analytics foundation
**Description:** As a product owner, I want the schema ready for Outlier Rank feature.

**Acceptance Criteria:**
- [ ] Schema ready: outlier_rank, outlier_score columns exist
- [ ] Placeholder UI: "Outlier Rank" column with "Coming Soon" badge
- [ ] Documentation comment: Outlier rank will identify videos performing above channel average
- [ ] npm run typecheck passes

---

## Functional Requirements

### Data Model

**FR-1:** Vault type expansion
- Add 'youtube' to vaults.vault_type CHECK constraint
- YouTube vaults have same membership/RLS as other vaults
- YouTube vaults are bank-scoped (per workspace)

**FR-2:** youtube_videos table
- All columns as specified in US-002
- Foreign keys: vault_id → vaults.id, bank_id → banks.id, user_id → auth.users.id
- Unique constraint: (bank_id, youtube_video_id) - prevent duplicate imports per workspace
- Indexes for: vault lookups, channel filtering, popularity sorting, search

**FR-3:** Transcript storage
- Full transcript stored in `transcript` column (TEXT)
- Language detected and stored in `transcript_language`
- Used for AI chat and full-text search

### Import Flow

**FR-4:** Import validation
- Reject imports to non-youtube vault types
- Check for existing video via (bank_id, youtube_video_id) unique constraint
- Return appropriate error: "Video already imported in this workspace"

**FR-5:** Metadata extraction
- Fetch from YouTube Data API v3: videos.list endpoint
- Extract: snippet (title, description, thumbnails, channelTitle, publishedAt, categoryId), statistics (viewCount, likeCount, commentCount), contentDetails (duration)
- Channel subscriber count: Separate channels.list call (or cache)
- Format duration: ISO 8601 to seconds

### UI/UX

**FR-6:** Thumbnail display
- Primary thumbnail: medium quality (320x180 or 120x90)
- Lazy loading for performance
- Fallback placeholder on error

**FR-7:** Number formatting
- Views/Likes/Comments: Compact format (1.2M, 450K, 1.5K)
- Subscriber count: Compact format
- Duration: MM:SS or H:MM:SS

**FR-8:** AI Chat parity
- YouTube videos support same chat features as calls
- Citations reference transcript segments
- Chat history per video

### Navigation

**FR-9:** Vault type filter
- URL param: ?type=youtube | ?type=calls | ?type=all
- Default: "All" shows mixed (if user has both types)
- Filter tabs visible in vault list pane

**FR-10:** YouTube vault auto-creation
- On first import, create "My YouTube Videos" vault automatically
- Vault created in user's active bank (workspace)
- User can rename later via vault settings

---

## Non-Goals (Out of Scope)

1. **YouTube upload:** This is import-only, not publishing back to YouTube
2. **Playlist import:** Single videos only, no playlist support for MVP
3. **Channel subscription sync:** No automatic import of new channel videos
4. **Video download:** Stream from YouTube, no local file storage
5. **Sidebar navigation:** Dedicated "YouTube Videos" sidebar item deferred to future phase
6. **Outlier Rank algorithm:** Schema ready, but calculation logic not implemented
7. **Video player:** External link to YouTube only, no embedded player
8. **Comments import:** Store comment count only, not actual comments
9. **Multi-language transcripts:** One transcript per video (primary language)
10. **Live streams:** Regular videos only, no live stream support

---

## Design Considerations

### Visual Design

**YouTube-Style Table:**
- Clean, card-based rows with prominent thumbnails
- White/light background (not dark like cinema)
- Clear visual hierarchy: Thumbnail → Title → Channel → Stats
- Hover: Subtle shadow lift, thumbnail slight zoom

**Color Usage:**
- Follow existing brand guidelines (v4.2)
- YouTube red (#FF0000) for external link icons only
- Vibe orange for active states (per brand guidelines)

**Typography:**
- Title: Inter Medium, 14px
- Channel: Inter Regular, 12px, muted
- Stats: Inter Medium, 12px, tabular-nums

### Components to Reuse

- **Layout:** AppShell, 4-pane layout
- **Table:** Custom YouTubeVideoTable (NOT TranscriptTable)
- **Detail Panel:** Custom YouTubeVideoDetail (similar pattern to CallDetailPanel)
- **Chat:** Reuse existing chat components
- **Badges:** Existing Badge component for Category, Coming Soon
- **Buttons:** Existing Button variants
- **Icons:** Remix Icon (@remixicon/react)
- **Loading:** Skeleton components for thumbnails and text

### New Components Needed

- `YouTubeVideoTable` - Main video list
- `YouTubeVideoRow` - Individual video row
- `YouTubeVideoDetail` - Detail panel with chat
- `YouTubeStatsBadge` - Formatted view/like/comment counts
- `ChannelInfo` - Channel name + subscriber count
- `VideoThumbnail` - Lazy-loaded thumbnail with fallback

---

## Technical Considerations

### Database

**Migration Strategy:**
1. Add 'youtube' to vault_type enum (constraint update)
2. Create youtube_videos table
3. Add indexes and RLS policies
4. Backfill: None (new feature, no existing data)

**RLS Policies:**
- SELECT: User must be vault member
- INSERT: User must be vault member with write permission
- UPDATE: Vault admin/owner only
- DELETE: Vault admin/owner only

### API Integration

**YouTube Data API:**
- Already integrated via `youtube-api` edge function
- Extend to fetch additional metadata (channel subscribers if needed)
- Rate limit consideration: 10,000 units/day quota

**Search:**
- Full-text search on title, description, transcript
- Use PostgreSQL tsvector for performance
- Support filters: channel, category, date range

### Performance

**Thumbnails:**
- Lazy load with intersection observer
- CDN URL from YouTube (i.ytimg.com)
- Fallback to placeholder on 404

**Pagination:**
- 20 videos per page (like transcripts)
- Cursor-based or offset pagination

**Chat:**
- Reuse existing chat-stream infrastructure
- No separate youtube-specific chat function if possible

---

## Success Metrics

1. **Import Success Rate:** >95% of valid YouTube URLs import successfully
2. **Metadata Completeness:** 100% of imported videos have all metadata fields populated
3. **AI Chat Quality:** Users can ask questions about video content and receive relevant, cited answers
4. **UI Performance:** Table renders <1s for 20 videos, thumbnails lazy-load smoothly
5. **User Adoption:** [Future metric] % of users with YouTube vaults actively importing

---

## Open Questions

1. **Channel subscriber count:** Is this available in the same API call, or require separate channels.list? (Need to check YouTube Data API docs)
2. **Transcript language detection:** Use YouTube's auto-detect or detect server-side?
3. **Timestamp citations:** Can we get word-level timestamps from YouTube transcripts? (Probably not with current API)
4. **Outlier Rank algorithm:** Will this be calculated per-channel, per-category, or globally?
5. **Video categories:** YouTube has numeric category IDs - map to human-readable names?

---

## Implementation Phases

### Phase 1: Foundation (US-001, US-002, US-003)
- Database schema
- Edge function updates
- Basic types

### Phase 2: Core UI (US-004, US-005, US-006)
- Hooks
- Video table
- Detail panel

### Phase 3: Integration (US-007, US-008, US-009)
- Vault page integration
- AI chat wiring
- Import form updates

### Phase 4: Polish (US-010)
- Analytics foundation
- Coming soon badges
- Final verification

---

## Appendix

### YouTube Data API Fields Mapping

| YouTube API Field | youtube_videos Column | Notes |
|-------------------|----------------------|-------|
| id | youtube_video_id | Video ID (e.g., "dQw4w9WgXcQ") |
| snippet.title | title | Video title |
| snippet.channelTitle | channel_name | Channel name |
| snippet.publishedAt | published_at | ISO 8601 timestamp |
| snippet.description | description | Full description |
| snippet.categoryId | category | Map to name or store ID? |
| snippet.thumbnails.medium.url | thumbnail_url | 320x180 |
| snippet.thumbnails.medium.width | thumbnail_width | |
| snippet.thumbnails.medium.height | thumbnail_height | |
| contentDetails.duration | duration_seconds | PT4M13S → 253 |
| statistics.viewCount | view_count | |
| statistics.likeCount | like_count | |
| statistics.commentCount | comment_count | |
| (channels.list) | channel_subscriber_count | Separate API call |

### URL Patterns

**YouTube Video URL:**
- https://youtube.com/watch?v=VIDEO_ID
- https://youtu.be/VIDEO_ID
- https://youtube.com/embed/VIDEO_ID

**Thumbnail URL:**
- https://i.ytimg.com/vi/VIDEO_ID/mqdefault.jpg (320x180)
- https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg (480x360)

---

**Status:** Draft  
**Last Updated:** 2026-02-10  
**Author:** Claude Code  
**Reviewers:** [Pending]
