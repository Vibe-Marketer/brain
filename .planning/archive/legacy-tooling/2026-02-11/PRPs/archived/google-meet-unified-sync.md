# Google Meet Unified Sync Integration PRP

**Created**: 2026-01-11
**Status**: Ready for Implementation
**Confidence Score**: 9/10

---

## Goal

**Feature Goal**: Complete the Google Meet integration with automatic background sync, unified search across all sources, and a seamless UI that treats all connected integrations as one unified call library.

**Deliverable**:
1. Background polling system (pg_cron) that automatically syncs Google Meet recordings every 15-30 minutes
2. Initial 30-day sync triggered immediately after OAuth connection
3. Unified SyncTab UI showing sync status for all integrations with inline connection wizard
4. Unified search that queries all connected sources by default
5. Single Transcripts table showing all calls with source indicators

**Success Definition**:
- User connects Google Meet OAuth and sees 30 days of meetings synced automatically
- Background job runs every 15 min and syncs new recordings without user action
- Search returns results from both Fathom and Google Meet
- All calls appear in same table with source platform indicator
- Duplicate meetings (same call in both Fathom and Google Meet) merge to single row

---

## User Persona

**Target User**: CallVault user who records meetings on Google Meet (potentially alongside Fathom)

**Use Case**: User wants all their meeting recordings and transcripts in one place, searchable and accessible without manually importing from each platform.

**User Journey**:
1. User clicks "+" button in Sync pane → sees available integrations
2. Clicks "Google Meet" → connection wizard appears inline
3. Completes OAuth → immediately sees "Syncing last 30 days..."
4. Goes about their day → new meetings appear automatically
5. Searches for "budget meeting" → finds it regardless of which platform recorded it

**Pain Points Addressed**:
- No more manual "Sync" button clicking for each platform
- No more switching between platforms to find recordings
- No more missing recordings because forgot to sync
- Single search interface for all content

---

## Why

- **User Experience**: Users shouldn't need to think about which platform recorded a call - it should "just be there"
- **Competitive Advantage**: Unified multi-source call library is a key differentiator
- **Reduced Friction**: The One-Click Promise - minimize user actions
- **Feature Completion**: Backend is 100% complete but unused - frontend needs to surface it

---

## What

### User-Visible Behavior

1. **Sync Pane (2nd Column)**:
   - Shows sync status for all connected integrations
   - "+" button at top to add integrations
   - Each integration shows: icon, name, status (syncing/idle/error), last sync time
   - Connection wizard pops up inline (not in Settings)

2. **Integration Dropdown (when clicking "+")**:
   - Lists all integrations
   - Connected: Green checkmark icon
   - Disconnected: Plug icon (clickable to connect)
   - Clicking disconnected integration opens wizard

3. **Search**:
   - Searches all connected integrations by default
   - Filter checkboxes for each source (auto-checked when connected)
   - Can uncheck to filter to specific source

4. **Transcripts Table**:
   - All calls from all sources in single table
   - Source indicator column/badge (Fathom logo, Google Meet logo)
   - Duplicate meetings show as single merged row

5. **Auto-Sync**:
   - Background job polls every 15 minutes
   - Initial sync: 30 days on first OAuth
   - No user action required after setup

### Technical Requirements

1. **pg_cron Background Job**:
   - Runs every 15 minutes
   - Queries all users with Google OAuth tokens
   - Calls Google Calendar API with syncToken for efficiency
   - Checks Google Drive for new recordings
   - Creates sync jobs for new recordings found

2. **Initial Sync on OAuth**:
   - After OAuth callback success, trigger 30-day sync
   - Show "Initial sync in progress..." in UI
   - Use existing sync job infrastructure

3. **Unified Search**:
   - Add `source_platform` column to `transcript_chunks` table
   - Modify `hybrid_search_transcripts` RPC to accept platform filter
   - Frontend passes array of enabled sources

4. **Deduplication Display**:
   - Use existing `is_primary` field to determine which row shows
   - Merged meetings show primary source's data
   - Badge/tooltip shows "Also in: Fathom" when merged

### Success Criteria

- [ ] OAuth callback triggers 30-day initial sync automatically
- [ ] pg_cron job runs every 15 minutes for all connected users
- [ ] New Google Meet recordings appear without user action
- [ ] Search returns results from all sources by default
- [ ] Transcripts table shows source indicator for each call
- [ ] Duplicate meetings display as single merged row
- [ ] "+" button in Sync pane opens inline connection wizard
- [ ] All connected integrations show sync status in real-time

---

## All Needed Context

### Context Completeness Check

_This PRP provides everything needed for an AI agent unfamiliar with the codebase to implement successfully._

### Documentation & References

```yaml
# MUST READ - Include these in your context window

# Existing Sync Architecture (CRITICAL - follow these patterns)
- file: supabase/functions/webhook/index.ts
  why: Complete Fathom auto-sync implementation - follow this pattern exactly
  pattern: processMeetingWebhook() shows how to sync, trigger embeddings, handle team accounts
  gotcha: Uses EdgeRuntime.waitUntil() for background processing

- file: supabase/functions/sync-meetings/index.ts
  why: Manual sync implementation - shows sync job pattern
  pattern: Creates sync_jobs, updates progress, calls embed-chunks and generate-ai-titles
  gotcha: Uses composite key (recording_id, user_id) for multi-user support

- file: src/hooks/useSyncTabState.ts
  why: Real-time sync status monitoring
  pattern: Supabase realtime subscription + polling fallback
  gotcha: Channel naming and filter syntax

# Google Meet Backend (COMPLETE - just need to wire up)
- file: supabase/functions/google-meet-fetch-meetings/index.ts
  why: Fetches calendar events with Google Meet links
  pattern: Rate limiting, token refresh, pagination
  gotcha: Uses syncToken for incremental sync - store per user

- file: supabase/functions/google-meet-sync-meetings/index.ts
  why: Full sync implementation with Drive search
  pattern: Searches Drive for recordings/transcripts, handles dedup
  gotcha: Uses negative recording_ids for Google Meet to avoid Fathom collision

- file: supabase/functions/google-oauth-callback/index.ts
  why: OAuth completion handler
  pattern: Stores tokens, captures email
  modification_needed: Trigger initial sync after token storage

# Search Implementation
- file: supabase/functions/semantic-search/index.ts
  why: Current search implementation
  pattern: Calls hybrid_search_transcripts RPC
  modification_needed: Add source_platform filter parameter

- file: src/hooks/useGlobalSearch.ts
  why: Frontend search hook
  modification_needed: Pass source platforms to search

# Frontend Components
- file: src/components/transcripts/SyncTab.tsx
  why: Current sync UI - needs major refactoring
  pattern: DateRangePicker, UnsyncedMeetingsSection, SyncedTranscriptsSection
  modification_needed: Add IntegrationStatusPane, unified fetch

- file: src/components/settings/GoogleMeetSetupWizard.tsx
  why: Connection wizard - reuse inline in SyncTab
  pattern: Multi-step wizard with OAuth flow

- file: src/components/settings/IntegrationStatusCard.tsx
  why: Status card for integrations
  pattern: Shows connected/disconnected state with icons

# Database Migrations
- file: supabase/migrations/20260110000002_add_deduplication_fields.sql
  why: Dedup fields already exist on fathom_calls
  fields: source_platform, is_primary, merged_from, meeting_fingerprint

- file: supabase/migrations/20260110000010_add_google_oauth_fields.sql
  why: OAuth fields already exist on user_settings
  fields: google_oauth_*, google_sync_token (ADD THIS)

# External Documentation
- url: https://supabase.com/docs/guides/cron
  why: pg_cron setup and job scheduling
  critical: Jobs have 10-minute timeout, max 8 concurrent

- url: https://developers.google.com/calendar/api/guides/sync
  why: Incremental sync with syncToken
  critical: syncToken reduces API calls by 90-95%

- url: https://supabase.com/docs/guides/database/extensions/http
  why: HTTP extension for calling Edge Functions from pg_cron
  critical: Must enable extension before using
```

### Current Codebase Tree (Relevant Files)

```
src/
├── components/
│   ├── search/
│   │   ├── GlobalSearchModal.tsx       # Search modal - add source filter
│   │   └── SearchResultItem.tsx        # Results - add source badge
│   ├── settings/
│   │   ├── IntegrationsTab.tsx         # Current integration config
│   │   ├── IntegrationStatusCard.tsx   # Status cards - reuse
│   │   └── GoogleMeetSetupWizard.tsx   # Wizard - make reusable
│   └── transcripts/
│       ├── SyncTab.tsx                 # Main sync UI - MAJOR REFACTOR
│       ├── SyncedTranscriptsSection.tsx # Table - add source column
│       └── ActiveSyncJobsCard.tsx      # Sync progress - reuse
├── hooks/
│   ├── useGlobalSearch.ts              # Search hook - add filter
│   ├── useMeetingsSync.ts              # Sync logic - extend for Google
│   └── useSyncTabState.ts              # Realtime state - extend
├── lib/
│   └── api-client.ts                   # API functions exist, unused
└── stores/
    └── searchStore.ts                  # Search state - add filters

supabase/
├── functions/
│   ├── google-meet-fetch-meetings/     # EXISTS - unused
│   ├── google-meet-sync-meetings/      # EXISTS - unused
│   ├── google-oauth-callback/          # EXISTS - needs trigger
│   ├── google-poll-sync/               # CREATE - pg_cron target
│   └── semantic-search/                # MODIFY - add platform filter
└── migrations/
    ├── 20260111000001_add_google_sync_token.sql      # CREATE
    ├── 20260111000002_add_source_platform_to_chunks.sql # CREATE
    └── 20260111000003_create_google_poll_job.sql     # CREATE
```

### Desired Codebase Tree (Files to Add/Modify)

```
src/
├── components/
│   ├── search/
│   │   ├── GlobalSearchModal.tsx       # MODIFY: Add source filter UI
│   │   ├── SearchResultItem.tsx        # MODIFY: Add source badge
│   │   └── SourceFilterCheckboxes.tsx  # CREATE: Filter checkboxes
│   ├── sync/                           # CREATE: New sync components
│   │   ├── IntegrationSyncPane.tsx     # CREATE: 2nd pane showing all integrations
│   │   ├── IntegrationStatusRow.tsx    # CREATE: Single integration row
│   │   ├── AddIntegrationButton.tsx    # CREATE: "+" button with dropdown
│   │   └── InlineConnectionWizard.tsx  # CREATE: Wizard wrapper for inline use
│   └── transcripts/
│       ├── SyncTab.tsx                 # MODIFY: Use new sync pane layout
│       └── SyncedTranscriptsSection.tsx # MODIFY: Add source column
├── hooks/
│   ├── useGlobalSearch.ts              # MODIFY: Accept sourcePlatforms param
│   ├── useIntegrationSync.ts           # CREATE: Unified multi-source sync
│   └── useSyncTabState.ts              # MODIFY: Track all integrations
└── stores/
    └── searchStore.ts                  # MODIFY: Add sourceFilters state

supabase/
├── functions/
│   ├── google-oauth-callback/          # MODIFY: Trigger initial sync
│   ├── google-poll-sync/               # CREATE: pg_cron target function
│   │   └── index.ts                    #   Polls for all users, creates sync jobs
│   └── semantic-search/                # MODIFY: Add source_platform filter
└── migrations/
    ├── 20260111000001_add_google_sync_token.sql
    ├── 20260111000002_add_source_platform_to_chunks.sql
    └── 20260111000003_create_google_poll_job.sql
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Google syncToken must be stored per user
// The token is user-specific and becomes invalid after 7 days of inactivity
// Store in user_settings.google_sync_token

// CRITICAL: pg_cron has 10-minute timeout
// Split work into small chunks, use sync_jobs table for tracking
// Don't process all users in single job - stagger them

// CRITICAL: Negative recording_ids for Google Meet
// Fathom uses positive recording_ids from their API
// Google Meet uses negative IDs to avoid collision: Math.min(existingMin - 1, -1)

// CRITICAL: Rate limiting
// Google Calendar: 50 requests/min per user (we use 50/min)
// Google Drive: 30 requests/min per user (we use 30/min)
// Use existing throttleShared() function pattern

// GOTCHA: Supabase realtime channels must have unique names
// Current pattern: `sync_jobs_${user_id}`
// Extend to: `integration_status_${user_id}`

// GOTCHA: http extension must be enabled before pg_cron can make HTTP calls
// Run: CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

// GOTCHA: Connection wizard currently uses window.location.href for OAuth
// When inline, need to use popup or iframe approach instead
```

---

## Implementation Blueprint

### Data Models and Structure

```sql
-- Migration: 20260111000001_add_google_sync_token.sql
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS google_sync_token TEXT,
ADD COLUMN IF NOT EXISTS google_last_poll_at TIMESTAMPTZ;

COMMENT ON COLUMN user_settings.google_sync_token IS 'Google Calendar sync token for incremental sync';
COMMENT ON COLUMN user_settings.google_last_poll_at IS 'Last successful poll timestamp';

-- Migration: 20260111000002_add_source_platform_to_chunks.sql
ALTER TABLE transcript_chunks
ADD COLUMN IF NOT EXISTS source_platform TEXT DEFAULT 'fathom';

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_source_platform
ON transcript_chunks(source_platform);

-- Backfill existing chunks from fathom_calls
UPDATE transcript_chunks tc
SET source_platform = fc.source_platform
FROM fathom_calls fc
WHERE tc.recording_id = fc.recording_id
  AND tc.user_id = fc.user_id
  AND tc.source_platform = 'fathom';

-- Migration: 20260111000003_create_google_poll_job.sql
-- Enable HTTP extension
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create the polling function
CREATE OR REPLACE FUNCTION trigger_google_poll_sync()
RETURNS void AS $$
DECLARE
  supabase_url TEXT := current_setting('app.supabase_url');
  service_key TEXT := current_setting('app.service_role_key');
BEGIN
  PERFORM extensions.http_post(
    supabase_url || '/functions/v1/google-poll-sync',
    '{}',
    'application/json',
    jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'Content-Type', 'application/json'
    )::text
  );
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Google poll sync failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Schedule job every 15 minutes
SELECT cron.schedule(
  'google-poll-sync',
  '*/15 * * * *',
  'SELECT trigger_google_poll_sync()'
);
```

```typescript
// New types for integration status
interface IntegrationStatus {
  platform: 'fathom' | 'google_meet' | 'zoom';
  connected: boolean;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError?: string;
  email?: string;  // Connected account email
}

interface SearchFilters {
  sourcePlatforms: ('fathom' | 'google_meet' | 'zoom')[];
  // ... existing filters
}
```

### Implementation Tasks (Ordered by Dependencies)

```yaml
Task 1: CREATE supabase/migrations/20260111000001_add_google_sync_token.sql
  - IMPLEMENT: Add google_sync_token and google_last_poll_at columns
  - FOLLOW pattern: Existing migration structure (20260110000010_add_google_oauth_fields.sql)
  - PLACEMENT: supabase/migrations/

Task 2: CREATE supabase/migrations/20260111000002_add_source_platform_to_chunks.sql
  - IMPLEMENT: Add source_platform to transcript_chunks, backfill existing
  - FOLLOW pattern: Existing deduplication migration
  - DEPENDENCIES: None
  - PLACEMENT: supabase/migrations/

Task 3: CREATE supabase/functions/google-poll-sync/index.ts
  - IMPLEMENT: Background polling function for pg_cron
  - PURPOSE: Query all users with Google OAuth, check for new recordings, create sync jobs
  - FOLLOW pattern: sync-meetings/index.ts (job creation, background processing)
  - INCLUDE: Rate limiting, syncToken usage, error handling per user
  - PLACEMENT: supabase/functions/google-poll-sync/

Task 4: CREATE supabase/migrations/20260111000003_create_google_poll_job.sql
  - IMPLEMENT: Enable http extension, create pg_cron job
  - FOLLOW pattern: Supabase cron documentation
  - DEPENDENCIES: Task 3 must be deployed first
  - PLACEMENT: supabase/migrations/

Task 5: MODIFY supabase/functions/google-oauth-callback/index.ts
  - ADD: After storing tokens, trigger initial 30-day sync
  - FOLLOW pattern: create-fathom-webhook/index.ts (post-OAuth action)
  - CALL: google-meet-fetch-meetings then google-meet-sync-meetings
  - PLACEMENT: In-place modification

Task 6: MODIFY supabase/functions/semantic-search/index.ts
  - ADD: Accept source_platform filter parameter in request body
  - ADD: Pass filter to hybrid_search_transcripts RPC
  - FOLLOW pattern: Existing parameter handling
  - PLACEMENT: In-place modification

Task 7: MODIFY hybrid_search_transcripts RPC function
  - ADD: filter_source_platform TEXT[] parameter
  - ADD: Filter in both semantic and FTS CTEs
  - FOLLOW pattern: Existing filter parameters
  - PLACEMENT: Database function modification

Task 8: CREATE src/components/sync/IntegrationSyncPane.tsx
  - IMPLEMENT: 2nd pane showing all integration statuses
  - INCLUDE: AddIntegrationButton, list of IntegrationStatusRow
  - FOLLOW pattern: ActiveSyncJobsCard.tsx (status display)
  - PLACEMENT: src/components/sync/

Task 9: CREATE src/components/sync/IntegrationStatusRow.tsx
  - IMPLEMENT: Single row showing integration status
  - INCLUDE: Icon, name, status indicator, last sync time
  - FOLLOW pattern: IntegrationStatusCard.tsx
  - PLACEMENT: src/components/sync/

Task 10: CREATE src/components/sync/AddIntegrationButton.tsx
  - IMPLEMENT: "+" button with dropdown of available integrations
  - INCLUDE: Connected (green check), disconnected (plug icon) states
  - FOLLOW pattern: Button component patterns
  - PLACEMENT: src/components/sync/

Task 11: CREATE src/components/sync/InlineConnectionWizard.tsx
  - IMPLEMENT: Wrapper to show connection wizard inline (not in modal)
  - REUSE: GoogleMeetSetupWizard, FathomSetupWizard logic
  - MODIFY: OAuth redirect handling for inline use
  - PLACEMENT: src/components/sync/

Task 12: MODIFY src/components/transcripts/SyncTab.tsx
  - REFACTOR: Replace current layout with IntegrationSyncPane
  - ADD: Unified fetch that queries all connected sources
  - FOLLOW pattern: Existing SyncTab structure
  - PLACEMENT: In-place modification

Task 13: MODIFY src/components/transcripts/SyncedTranscriptsSection.tsx
  - ADD: Source platform column/badge in table
  - ADD: Visual indicator (Fathom logo, Google Meet logo)
  - FOLLOW pattern: Existing table column patterns
  - PLACEMENT: In-place modification

Task 14: CREATE src/components/search/SourceFilterCheckboxes.tsx
  - IMPLEMENT: Checkboxes for filtering search by source
  - BEHAVIOR: Auto-checked when integration connected
  - FOLLOW pattern: Existing filter UI components
  - PLACEMENT: src/components/search/

Task 15: MODIFY src/hooks/useGlobalSearch.ts
  - ADD: Accept sourcePlatforms parameter
  - ADD: Pass to semanticSearch() call
  - FOLLOW pattern: Existing hook parameters
  - PLACEMENT: In-place modification

Task 16: MODIFY src/stores/searchStore.ts
  - ADD: sourceFilters state (array of enabled platforms)
  - ADD: toggleSourceFilter action
  - FOLLOW pattern: Zustand store patterns
  - PLACEMENT: In-place modification

Task 17: CREATE src/hooks/useIntegrationSync.ts
  - IMPLEMENT: Hook for managing multi-integration sync state
  - INCLUDE: Status for each integration, combined sync trigger
  - FOLLOW pattern: useSyncTabState.ts
  - PLACEMENT: src/hooks/

Task 18: MODIFY src/components/search/GlobalSearchModal.tsx
  - ADD: SourceFilterCheckboxes component
  - WIRE: Filter state to search query
  - FOLLOW pattern: Existing modal structure
  - PLACEMENT: In-place modification

Task 19: MODIFY src/components/search/SearchResultItem.tsx
  - ADD: Source platform badge (small icon)
  - FOLLOW pattern: Existing result item structure
  - PLACEMENT: In-place modification
```

### Implementation Patterns & Key Details

```typescript
// Pattern: google-poll-sync Edge Function
// supabase/functions/google-poll-sync/index.ts

import { createClient } from '@supabase/supabase-js';
import { refreshGoogleOAuthTokens } from '../google-oauth-refresh/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all users with Google OAuth connected
    const { data: users, error } = await supabase
      .from('user_settings')
      .select('user_id, google_oauth_access_token, google_oauth_refresh_token, google_oauth_token_expires, google_sync_token, google_last_poll_at')
      .not('google_oauth_access_token', 'is', null);

    if (error) throw error;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'No users to poll' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process users in batches (avoid timeout)
    const BATCH_SIZE = 10;
    const results = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(user => pollUserMeetings(supabase, user))
      );

      results.push(...batchResults);
    }

    return new Response(JSON.stringify({
      processed: results.length,
      success: results.filter(r => r.status === 'fulfilled').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Poll sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function pollUserMeetings(supabase: any, user: any) {
  // 1. Check if token needs refresh
  let accessToken = user.google_oauth_access_token;
  if (user.google_oauth_token_expires && user.google_oauth_token_expires <= Date.now()) {
    accessToken = await refreshGoogleOAuthTokens(user.user_id, user.google_oauth_refresh_token);
  }

  // 2. Use syncToken for incremental sync (if available)
  const syncToken = user.google_sync_token;

  // 3. Call google-meet-fetch-meetings internally
  // ... (follow existing pattern)

  // 4. If new meetings found, create sync job
  // ... (follow sync-meetings pattern)

  // 5. Update last_poll_at and sync_token
  await supabase
    .from('user_settings')
    .update({
      google_last_poll_at: new Date().toISOString(),
      google_sync_token: newSyncToken
    })
    .eq('user_id', user.user_id);
}
```

```typescript
// Pattern: Initial sync trigger in OAuth callback
// Add to supabase/functions/google-oauth-callback/index.ts after storing tokens

// After line ~130 (after successful token storage)
// Trigger initial 30-day sync in background
EdgeRuntime.waitUntil((async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Create initial sync job
    const { data: job } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: user.id,
        status: 'processing',
        progress_current: 0,
        progress_total: 0, // Will be updated
        recording_ids: [],
      })
      .select()
      .single();

    // Fetch meetings from last 30 days
    const response = await supabase.functions.invoke('google-meet-fetch-meetings', {
      body: {
        createdAfter: thirtyDaysAgo.toISOString(),
        createdBefore: new Date().toISOString(),
      },
      headers: { Authorization: `Bearer ${user.access_token}` }
    });

    if (response.data?.meetings?.length > 0) {
      // Sync all found meetings
      await supabase.functions.invoke('google-meet-sync-meetings', {
        body: { eventIds: response.data.meetings.map((m: any) => m.id) },
        headers: { Authorization: `Bearer ${user.access_token}` }
      });
    }
  } catch (error) {
    console.error('Initial sync failed:', error);
  }
})());
```

```typescript
// Pattern: Source filter in search
// Modify useGlobalSearch.ts

export function useGlobalSearch(sourcePlatforms?: string[]) {
  const performSearch = async (query: string) => {
    const response = await semanticSearch(query, {
      limit: 20,
      sourcePlatforms: sourcePlatforms || ['fathom', 'google_meet', 'zoom'],
    });
    // ...
  };
}

// Modify semantic-search edge function
const { query, limit, sourcePlatforms } = await req.json();

const { data } = await supabase.rpc('hybrid_search_transcripts', {
  query_text: query,
  query_embedding: embedding,
  match_count: limit,
  filter_source_platform: sourcePlatforms, // NEW
});
```

### Integration Points

```yaml
DATABASE:
  - migration: Add google_sync_token to user_settings
  - migration: Add source_platform to transcript_chunks with backfill
  - migration: Create pg_cron job for polling
  - index: CREATE INDEX idx_transcript_chunks_source_platform

CONFIG:
  - app.supabase_url: Required for pg_cron HTTP calls
  - app.service_role_key: Required for pg_cron authentication

EDGE_FUNCTIONS:
  - google-poll-sync: New function for pg_cron to call
  - google-oauth-callback: Trigger initial sync
  - semantic-search: Add source_platform filter
  - hybrid_search_transcripts: Add filter parameter

FRONTEND:
  - SyncTab: Major refactor for unified layout
  - GlobalSearchModal: Add source filter UI
  - SearchResultItem: Add source badge
```

---

## Validation Loop

### Level 1: Syntax & Style

```bash
# After each file creation
npx eslint src/{new_files} --fix
npx tsc --noEmit

# Backend
deno lint supabase/functions/google-poll-sync/
deno check supabase/functions/google-poll-sync/index.ts
```

### Level 2: Unit Tests

```bash
# Frontend components
npm run test -- --testPathPattern="sync|search"

# Backend functions (manual via Supabase CLI)
supabase functions serve google-poll-sync --env-file .env.local
```

### Level 3: Integration Testing

```bash
# Start dev servers
npm run dev &
supabase start

# Test OAuth flow
# 1. Navigate to Settings > Integrations
# 2. Click Connect Google Meet
# 3. Complete OAuth
# 4. Verify: Initial sync starts automatically
# 5. Verify: Meetings appear in Transcripts table

# Test background poll
# 1. Wait 15 minutes (or manually trigger pg_cron job)
# 2. Record new meeting in Google Meet
# 3. Verify: Meeting syncs without user action

# Test unified search
# 1. Search for term that exists in both Fathom and Google Meet calls
# 2. Verify: Results from both sources appear
# 3. Verify: Source badges show correctly
# 4. Verify: Unchecking source filter hides those results
```

### Level 4: Visual & UX Validation

```bash
# Verify UI matches design requirements:
# 1. Sync pane shows all integrations with status
# 2. "+" button opens dropdown with correct icons
# 3. Connection wizard appears inline
# 4. Transcripts table has source indicator column
# 5. Search has source filter checkboxes
# 6. Duplicate meetings show as single merged row
```

---

## Final Validation Checklist

### Technical Validation

- [ ] All migrations apply successfully: `supabase db push`
- [ ] pg_cron job created: `SELECT * FROM cron.job WHERE jobname = 'google-poll-sync';`
- [ ] Edge functions deploy: `supabase functions deploy`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No ESLint errors: `npx eslint src/`

### Feature Validation

- [ ] OAuth callback triggers 30-day initial sync
- [ ] pg_cron job runs every 15 minutes
- [ ] New recordings sync automatically (no user action)
- [ ] Search returns results from all sources
- [ ] Source filter checkboxes work correctly
- [ ] Transcripts table shows source badges
- [ ] Duplicate meetings merge to single row
- [ ] "+" button opens integration dropdown
- [ ] Connection wizard works inline

### Code Quality Validation

- [ ] Follows existing patterns (sync-meetings, webhook)
- [ ] Uses existing components where possible
- [ ] Rate limiting implemented correctly
- [ ] Error handling is comprehensive
- [ ] Real-time updates work via Supabase channels

---

## Anti-Patterns to Avoid

- Do NOT create new sync patterns - follow existing sync-meetings and webhook patterns exactly
- Do NOT poll in frontend - use Supabase realtime subscriptions
- Do NOT process all users in single pg_cron run - batch to avoid timeout
- Do NOT hardcode OAuth redirect URIs - use environment configuration
- Do NOT skip syncToken usage - it reduces API calls by 90%+
- Do NOT mix positive/negative recording IDs - Google Meet MUST use negative
- Do NOT forget to trigger embedding generation after sync
