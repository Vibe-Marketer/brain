# YouTube Import Feature - Complete File Map

**Generated:** 2025-02-14  
**Purpose:** Quick reference for all files involved in YouTube import functionality

---

## Core Implementation Files

### Backend (Edge Functions)

#### Main Import Orchestrator
📁 **`supabase/functions/youtube-import/index.ts`** (816 lines)
- **Purpose:** Main import pipeline orchestration
- **Key Functions:**
  - `extractVideoId()` - Parses YouTube URLs
  - `generateYouTubeRecordingId()` - Creates unique IDs
  - `extractTranscriptText()` - Parses transcript responses
  - `buildFallbackVideoDetails()` - Fallback metadata extraction
  - Main Deno.serve handler
- **Dependencies:** youtube-api function, Transcript API
- **Database Tables:** fathom_calls, recordings, vaults, vault_entries, vault_memberships
- **External APIs:** Transcript API (transcriptapi.com)

#### YouTube Data API Wrapper
📁 **`supabase/functions/youtube-api/index.ts`** (445 lines)
- **Purpose:** YouTube Data API v3 integration
- **Actions:**
  - `search` - Search YouTube videos
  - `channel-videos` - Get videos from a channel
  - `video-details` - Fetch video metadata
  - `transcript` - Fetch transcript (via Transcript API)
  - `batch-transcripts` - Fetch multiple transcripts
- **External APIs:** YouTube Data API v3, Transcript API
- **Error Handling:** ApiHttpError class with retry logic

#### Shared Utilities
📁 **`supabase/functions/_shared/cors.ts`** (19 lines)
- **Purpose:** CORS headers for Edge Functions
- **Function:** `getCorsHeaders()`

---

### Frontend Components

#### Import Form UI
📁 **`src/components/import/YouTubeImportForm.tsx`** (283 lines)
- **Purpose:** User-facing import form with progress tracking
- **Key Features:**
  - URL validation and parsing
  - Vault selector integration
  - Simulated multi-step progress
  - Error state handling
  - Auto-paste detection
- **Props:** `onSuccess`, `onError`, `className`
- **Dependencies:** VaultSelector, ImportProgress, Button, Input

#### Import Progress Component
📁 **`src/components/import/ImportProgress.tsx`** (Inferred - not read directly)
- **Purpose:** Step-by-step progress visualization
- **Steps:** idle, validating, checking, fetching, transcribing, processing, done, error

#### Vault Selector
📁 **`src/components/vault/VaultSelector.tsx`** (Inferred)
- **Purpose:** Choose which vault to import video into
- **Integration:** Used by YouTubeImportForm

---

### Page Components

#### Manual Import Page
📁 **`src/pages/ManualImport.tsx`** (199+ lines)
- **Purpose:** Dedicated page for YouTube video imports
- **Features:**
  - YouTubeImportForm integration
  - Success state with actions (Chat, Search, View)
  - Import another video flow
  - Query invalidation on success
- **Route:** `/import` (inferred)
- **Layout:** Uses AppShell

#### Transcripts Tab (for viewing imports)
📁 **`src/components/transcripts/TranscriptsTab.tsx`** (790+ lines)
- **Purpose:** Main transcripts library view
- **Features:**
  - Filters by source_platform='youtube'
  - Displays imported videos alongside Fathom calls
  - Table view with YouTube-specific columns

---

### Type Definitions

#### YouTube Types
📁 **`src/types/youtube.ts`** (73 lines)
- **Exports:**
  - `YouTubeVideoMetadata` interface
  - `getYouTubeMetadata()` helper function
- **Fields:**
  - youtube_video_id, youtube_channel_id, youtube_channel_title
  - youtube_description, youtube_thumbnail, youtube_duration
  - youtube_view_count, youtube_like_count, youtube_comment_count
  - youtube_category_id, import_source, imported_at

---

### Utility Functions

#### YouTube Utilities
📁 **`src/lib/youtube-utils.ts`** (122 lines)
- **Exports:**
  - `parseYouTubeDuration(iso8601)` - Convert PT1H2M10S to seconds/display
  - `formatCompactNumber(num)` - Format 1234567 as "1.2M"
  - `YOUTUBE_CATEGORIES` - Category ID to name mapping
- **Use Cases:** Display duration, view counts, video categories

---

### Testing

#### Regression Tests
📁 **`supabase/functions/youtube-import/__tests__/youtube-import-regression.test.ts`** (49 lines)
- **Framework:** Vitest
- **Coverage:**
  - Downstream status preservation
  - JWT forwarding
  - Direct Transcript API usage
  - Error response structure
- **Test Type:** Static source code analysis (not runtime)

#### API Tests
📁 **`supabase/functions/youtube-api/__tests__/youtube-api-regression.test.ts`** (Exists but not read)
- **Purpose:** Test YouTube API wrapper functionality

---

### Configuration

#### Environment Variables
📁 **`.env`** (referenced)
- **YouTube Import Keys:**
  ```
  YOUTUBE_DATA_API_KEY="AIzaSyB-5OHLyCWibnpkO5-cIUh5ZBvsdCAq75E"
  TRANSCRIPT_API_KEY="sk_qIg9PTc9bkTSPbsWK-y-p455ljszZ-M6GMMHijsNGr0"
  ```
- **Supabase Config:**
  ```
  VITE_SUPABASE_URL="https://vltmrnjsubfzrgrtdqey.supabase.co"
  VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
  ```

#### Example Environment
📁 **`.env.example`** (referenced)
- **Purpose:** Template for required environment variables
- **Note:** YouTube/Transcript keys not listed in example file

---

## Database Schema (Inferred)

### Tables Used by Import

#### fathom_calls
- **Primary Table:** Legacy table for all recordings
- **YouTube Fields:**
  - `recording_id` - Generated via generateYouTubeRecordingId()
  - `user_id` - Owner
  - `title` - Video title
  - `full_transcript` - Transcript text
  - `recording_start_time` - Video published date
  - `url` - YouTube URL
  - `source_platform` - 'youtube'
  - `metadata` - JSONB with YouTubeVideoMetadata
  - `is_primary` - true
  - `transcript_source` - 'native'

#### recordings
- **New Recordings Table:**
- **Fields:**
  - `id` - UUID (returned as newRecordingUuid)
  - `bank_id` - User's bank
  - `owner_user_id` - User ID
  - `legacy_recording_id` - Links to fathom_calls.recording_id
  - `title` - Video title
  - `full_transcript` - Transcript text
  - `source_app` - 'youtube'
  - `source_metadata` - JSONB (YouTubeVideoMetadata)
  - `duration` - Seconds (parsed from ISO 8601)
  - `recording_start_time` - Video published date
  - `global_tags` - Empty array initially

#### vaults
- **Vault Organization:**
- **Fields:**
  - `id` - UUID
  - `bank_id` - Parent bank
  - `name` - 'YouTube Vault'
  - `vault_type` - 'youtube'

#### vault_entries
- **Links recordings to vaults:**
- **Fields:**
  - `vault_id` - References vaults.id
  - `recording_id` - References recordings.id (UUID, not legacy_recording_id)

#### vault_memberships
- **User vault permissions:**
- **Fields:**
  - `vault_id`
  - `user_id`
  - `role` - 'vault_owner'

#### banks
- **Workspace level:**
- **Fields:**
  - `id` - UUID
  - `type` - 'personal' or 'team'

#### bank_memberships
- **User bank access:**
- **Fields:**
  - `bank_id`
  - `user_id`

---

## External API Dependencies

### YouTube Data API v3
- **Base URL:** `https://www.googleapis.com/youtube/v3`
- **Endpoints Used:**
  - `/search` - Video search
  - `/videos` - Video details (snippet, contentDetails, statistics)
- **Authentication:** API Key
- **Rate Limits:** 10,000 quota units/day (default)
- **Used For:** Video metadata (title, description, stats, thumbnails)

### Transcript API (transcriptapi.com)
- **Base URL:** `https://transcriptapi.com/api/v2/youtube/transcript`
- **Parameters:**
  - `video_url` - YouTube video ID or URL
  - `format` - 'json' or 'text'
  - `include_timestamp` - true/false
  - `send_metadata` - true/false
- **Authentication:** Bearer token
- **Used For:** Video transcripts (primary source)
- **Response Formats:**
  - JSON: Array of segment objects with text/timestamp
  - Text: Plain string transcript

---

## Data Flow Diagram

```
User Input
    ↓
YouTubeImportForm.tsx
    ↓ (supabase.functions.invoke)
youtube-import/index.ts
    ├─→ extractVideoId()
    ├─→ Check fathom_calls for duplicates
    ├─→ Vault auto-creation logic
    │   ├─→ Query bank_memberships
    │   ├─→ Query/create vaults
    │   └─→ Create vault_memberships
    ├─→ youtube-api function (best effort)
    │   └─→ YouTube Data API v3
    ├─→ Transcript API (critical path)
    └─→ Database writes
        ├─→ INSERT fathom_calls
        ├─→ INSERT recordings
        └─→ INSERT vault_entries
    ↓
Response to Frontend
    ↓
onSuccess/onError callbacks
    ↓
Toast notification + UI update
```

---

## Component Dependency Graph

```
ManualImport.tsx
  ├─→ YouTubeImportForm.tsx
  │    ├─→ VaultSelector.tsx
  │    ├─→ ImportProgress.tsx
  │    ├─→ Button.tsx
  │    └─→ Input.tsx
  └─→ AppShell.tsx

YouTubeImportForm.tsx
  → supabase.functions.invoke('youtube-import')
    → youtube-import/index.ts
      ├─→ youtube-api/index.ts (optional)
      │    └─→ YouTube Data API v3
      └─→ Transcript API (required)
```

---

## File Modification Priority

For implementing fixes, modify files in this order:

### Phase 1: Backend Fixes (Critical)
1. ✅ `supabase/functions/youtube-import/index.ts` - Add retry logic
2. ✅ Create new migration for `import_logs` table
3. ✅ Create new migration for `import_youtube_video()` function

### Phase 2: Frontend Fixes (High)
4. ✅ `src/components/import/YouTubeImportForm.tsx` - Better error messages
5. ✅ `src/types/youtube.ts` - Add warnings/metadata_source fields

### Phase 3: Testing (Medium)
6. ✅ `supabase/functions/youtube-import/__tests__/youtube-import-regression.test.ts` - Add retry tests
7. ✅ Create new E2E test file: `e2e/youtube-import.spec.ts`

### Phase 4: Monitoring (Low)
8. ✅ Create monitoring dashboard SQL queries
9. ✅ Set up error alerting (Sentry/etc.)

---

## File Size Summary

| File | Lines | Size | Complexity |
|------|-------|------|------------|
| `youtube-import/index.ts` | 816 | ~31KB | High |
| `youtube-api/index.ts` | 445 | ~16KB | Medium |
| `YouTubeImportForm.tsx` | 283 | ~11KB | Medium |
| `ManualImport.tsx` | 199+ | ~8KB | Low |
| `TranscriptsTab.tsx` | 790+ | ~30KB | High |
| `youtube-utils.ts` | 122 | ~5KB | Low |
| `youtube.ts` | 73 | ~3KB | Low |
| **Total** | **~2,728** | **~104KB** | **Medium** |

---

## Quick Find Commands

```bash
# Find all YouTube-related files
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "youtube" {} \; | grep -v node_modules

# Search for specific functionality
grep -r "extractVideoId" --include="*.ts" --include="*.tsx"
grep -r "generateYouTubeRecordingId" --include="*.ts"
grep -r "YouTubeImportForm" --include="*.tsx"

# Check API keys in .env
grep -E "(YOUTUBE|TRANSCRIPT)" .env

# Find database queries
grep -r "from('fathom_calls')" supabase/functions/youtube-import/
grep -r "from('recordings')" supabase/functions/youtube-import/
```

---

## Related Documentation

- 📁 Main analysis: `YOUTUBE_IMPORT_DEBUG_REPORT.md`
- 🔧 Fix implementation: `YOUTUBE_IMPORT_FIXES.md`
- 📊 Quick summary: `YOUTUBE_IMPORT_SUMMARY.md`
- 🗺️ This file map: `YOUTUBE_IMPORT_FILES_MAP.md`

All located in: `/Users/admin/repos/brain/`
