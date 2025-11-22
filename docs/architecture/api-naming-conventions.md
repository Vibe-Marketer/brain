# API Naming Conventions - Conversion Brain

## Overview

This document describes the actual naming conventions used throughout Conversion Brain's codebase based on current implementation patterns. All examples reference real files where these patterns are implemented.

## Backend: Supabase Edge Functions

### Function Folder Naming
**Reference**: `supabase/functions/*/index.ts`

All Edge Functions use **kebab-case** for folder names:

**Current Functions (32 total)**:

**Core Meeting Operations**:
- `fetch-meetings` - Fetch meetings from Fathom
- `fetch-single-meeting` - Fetch single meeting details
- `sync-meetings` - Sync meetings to database
- `webhook` - Handle Fathom webhooks
- `resync-all-calls` - Re-sync all calls
- `delete-all-calls` - Delete all synced calls

**AI Processing**:
- `process-call-ai` - AI processing for calls
- `process-ai-jobs` - Process queued AI jobs
- `ai-analyze-transcripts` - Analyze transcripts with AI
- `auto-tag-call` - Auto-tag calls using AI
- `generate-call-title` - Generate titles with AI

**OAuth/Auth**:
- `fathom-oauth-url` - Get OAuth URL
- `fathom-oauth-callback` - Handle OAuth callback
- `fathom-oauth-refresh` - Refresh OAuth tokens

**Configuration**:
- `get-config-status` - Get configuration status
- `save-fathom-key` - Save API key
- `save-host-email` - Save host email
- `save-webhook-secret` - Save webhook secret
- `create-fathom-webhook` - Create webhook via OAuth

**Testing**:
- `test-fathom-connection` - Test API connection
- `test-oauth-connection` - Test OAuth connection
- `test-webhook` - Test webhook
- `test-webhook-endpoint` - Test webhook endpoint
- `test-webhook-connection` - Test webhook connection
- `test-webhook-signature` - Verify signatures
- `test-env-vars` - Test environment variables

**Data Operations**:
- `delete-account` - Delete user account
- `enrich-speaker-emails` - Enrich email data

**Delivery/Sharing**:
- `deliver-via-email` - Email delivery
- `deliver-to-slack` - Slack delivery
- `create-share-link` - Create sharing links
- `upload-knowledge-file` - Upload files

### Handler Pattern
**Reference**: `supabase/functions/webhook/index.ts`

All Edge Functions use the standard Deno handler pattern:
```typescript
Deno.serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Main logic
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

### Internal Function Naming
**Reference**: `supabase/functions/webhook/index.ts`

Internal functions within Edge Functions use **camelCase**:
- `processMeetingWebhook()` - Main processing logic
- `verifyWebhookSignature()` - Signature verification
- `handleRecordingCompleted()` - Event handlers
- `getErrorMessage()` - Utility functions
- `retryWithBackoff()` - Retry logic

## Frontend API Client

### Service Function Pattern
**Reference**: `src/lib/api-client.ts`

The API client exports individual functions (not a service object) using **camelCase**:

```typescript
export async function functionName(params): Promise<ApiResponse<T>> {
  return callEdgeFunction('edge-function-name', params);
}
```

### Standard Function Names
**Reference**: `src/lib/api-client.ts`

**Fetch Operations** (retrieve data):
- `fetchMeetings(params)` - Get meetings list
- `fetchSingleMeeting(recordingId)` - Get single meeting

**Sync Operations** (synchronize data):
- `syncMeetings(recordingIds)` - Sync meetings to database

**Test Operations** (verify connections):
- `testFathomConnection()` - Test API connection

**Save Operations** (persist settings):
- `saveFathomKey(apiKey)` - Save API key
- `saveWebhookSecret(secret)` - Save webhook secret
- `saveHostEmail(email)` - Save host email

**Get Operations** (retrieve config/status):
- `getConfigStatus()` - Get configuration status
- `getFathomOAuthUrl()` - Get OAuth URL

**OAuth Operations**:
- `completeFathomOAuth(code, state)` - Complete OAuth flow
- `refreshFathomOAuth()` - Refresh tokens

**Create Operations**:
- `createFathomWebhook()` - Create webhook

**Delete Operations**:
- `deleteAllCalls()` - Delete all calls

**Resync Operations**:
- `resyncAllCalls()` - Re-sync all calls

### Response Type Pattern
**Reference**: `src/lib/api-client.ts`

```typescript
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}
```

## React Hook Naming

### Custom Hook Files
**Reference**: `src/hooks/`

Hook files use **camelCase** with `use` prefix (7 hooks total):
- `useMeetingsSync.ts` - Meeting sync functionality
- `useCallAnalytics.ts` - Call analytics queries
- `useCategorySync.ts` - Category synchronization
- `useTableSort.ts` - Table sorting logic
- `useDragAndDrop.ts` - Drag and drop functionality
- `useVibeGreenValidator.ts` - Brand validation

**Exception**: `use-toast.ts` uses kebab-case (shadcn pattern)

### Hook Function Patterns
**Reference**: `src/hooks/useMeetingsSync.ts`

Hooks use **camelCase** function names with `use` prefix:
```typescript
export function useMeetingsSync() {
  // State and logic
  return {
    // Return values
  };
}
```

**React Query Hooks**:
```typescript
export function useCallAnalytics(timeRange: string = '30d') {
  return useQuery({
    queryKey: ['call-analytics', timeRange],
    queryFn: async (): Promise<CallAnalytics> => {
      // Query logic
    }
  });
}
```

### Internal Functions in Hooks
**Reference**: `src/hooks/useMeetingsSync.ts`

Internal functions within hooks use **camelCase**:
- `loadHostEmail()` - Load data
- `loadCategoryAssignments()` - Load assignments
- `checkSyncStatus()` - Check status
- `syncMeetings()` - Sync action
- `syncSingleMeeting()` - Single sync
- `viewUnsyncedMeeting()` - View action
- `downloadUnsyncedTranscript()` - Download action

### State Variable Naming
**Reference**: `src/hooks/useMeetingsSync.ts`

State variables follow patterns:

**Boolean States**:
- `loading` / `isLoading` - Generic loading
- `syncing` / `isSyncing` - Specific operation

**Data States**:
- `meetings` - Entity plural
- `hostEmail` - Specific value
- `syncProgress` - Progress object

**Set States** (for tracking multiple items):
- `syncingMeetings` - `Set<string>`

**Record States** (for mappings):
- `perMeetingCategories` - `Record<string, string>`

## Query Key Conventions

### String Array Pattern
**Reference**: `src/components/transcripts/TranscriptsTab.tsx`, `src/components/CallDetailDialog.tsx`

Query keys use **descriptive string arrays** defined inline:

```typescript
// Simple entity queries
queryKey: ["categories"]
queryKey: ["speakers"]
queryKey: ["user-settings"]

// Entity with parameters
queryKey: ["call-transcripts", recordingId]
queryKey: ["call-categories", recordingId]
queryKey: ["call-tags", recordingId]

// List queries with filters
queryKey: ["category-calls", searchQuery, combinedFilters, page, pageSize]
queryKey: ["category-assignments", calls.map((c) => c.recording_id)]

// Analytics
queryKey: ["call-analytics", timeRange]
```

### Naming Guidelines

1. **Use kebab-case** for multi-word keys (`"category-calls"`, not `"categoryCalls"`)
2. **Entity first** - Start with entity name (`"call-transcripts"`, not `"transcripts-for-call"`)
3. **Include all parameters** that affect the query result
4. **Keep arrays flat** when possible for easier invalidation

## Type Naming Conventions

### Interface Patterns
**Reference**: `src/hooks/useMeetingsSync.ts`, `src/hooks/useCallAnalytics.ts`

**Entity Types** (PascalCase):
```typescript
export interface Meeting {
  recording_id: string;
  title: string;
  created_at: string;
  synced: boolean;
  // ...
}

export interface CalendarInvitee {
  name: string;
  email: string;
  email_domain?: string;
  is_external?: boolean;
}

interface SyncJob {
  id: string;
  status: string;
  progress_current: number;
  progress_total: number;
}

interface CallAnalytics {
  totalCalls: number;
  participationRate: number;
  avgDuration: number;
  // ...
}
```

**Response Types**:
```typescript
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}
```

### Property Naming
Database fields use **snake_case**, JavaScript properties use **camelCase**:

**Database Fields** (snake_case):
- `recording_id`
- `created_at`
- `recording_start_time`
- `calendar_invitees`
- `full_transcript`
- `user_id`

**Computed Properties** (camelCase):
- `totalCalls`
- `participationRate`
- `avgDuration`
- `totalRecordingTime`

## Page Component Naming

### Page Files
**Reference**: `src/pages/`

Page components use **PascalCase** (5 pages total):
- `Login.tsx` - Login page
- `Settings.tsx` - Settings page
- `TranscriptsNew.tsx` - New transcripts view
- `OAuthCallback.tsx` - OAuth callback handler
- `NotFound.tsx` - 404 page

## Integration Patterns

### Supabase Client
**Reference**: `src/integrations/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
```

### Import Pattern
```typescript
import { supabase } from "@/integrations/supabase/client";
```

## Utility Library Naming

### Library Files
**Reference**: `src/lib/`

Utility files use **kebab-case** or **camelCase** (11 files total):
- `api-client.ts` - API client functions
- `fathom.ts` - Fathom API utilities
- `logger.ts` - Logging utilities
- `validations.ts` - Validation functions
- `filter-utils.ts` - Filter utilities
- `export-utils.ts` - Export utilities
- `export-utils-advanced.ts` - Advanced exports
- `chartUtils.ts` - Chart utilities
- `design-tokens.ts` - Design system tokens
- `utils.ts` - General utilities

### Utility Function Patterns
**Reference**: `src/lib/fathom.ts`

Export individual functions:
```typescript
export function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>
export function getErrorMessage(error: any): string
```

## File Organization

### Test Files
**Location**: `src/lib/__tests__/`

Test files use pattern: `{filename}.test.ts`
- `filter-utils.test.ts`
- `ai-agent-system.test.ts`

## Quick Reference Tables

### Backend Naming Summary

| Pattern | Convention | Example |
|---------|------------|---------|
| Edge Function folders | kebab-case | `fetch-meetings/` |
| Internal functions | camelCase | `processMeetingWebhook()` |
| Handler pattern | Deno.serve() | `Deno.serve(async (req) => {})` |

### Frontend Naming Summary

| Pattern | Convention | Example |
|---------|------------|---------|
| API client functions | camelCase | `fetchMeetings()` |
| Hooks | use + camelCase | `useMeetingsSync()` |
| Query keys | string arrays | `["category-calls", id]` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |
| Page components | PascalCase | `Settings.tsx` |
| Utility files | kebab-case | `api-client.ts` |
| Database fields | snake_case | `recording_id` |
| JS properties | camelCase | `totalCalls` |

### Function Prefix Patterns

| Prefix | Use Case | Example |
|--------|----------|---------|
| `fetch*` | Retrieve data from API | `fetchMeetings()` |
| `sync*` | Synchronize data | `syncMeetings()` |
| `save*` | Persist settings | `saveFathomKey()` |
| `get*` | Retrieve config/status | `getConfigStatus()` |
| `test*` | Verify connections | `testFathomConnection()` |
| `create*` | Create new resources | `createFathomWebhook()` |
| `delete*` | Remove data | `deleteAllCalls()` |
| `complete*` | Finish processes | `completeFathomOAuth()` |
| `refresh*` | Update tokens | `refreshFathomOAuth()` |
| `load*` | Load internal data | `loadHostEmail()` |
| `check*` | Verify status | `checkSyncStatus()` |
| `download*` | Download files | `downloadUnsyncedTranscript()` |
| `view*` | Display actions | `viewUnsyncedMeeting()` |

## Best Practices

### Do Follow
- Use kebab-case for all Edge Function folder names
- Use camelCase for all JavaScript/TypeScript functions
- Use PascalCase for types, interfaces, and React components
- Use snake_case for database fields (Supabase convention)
- Use query key factories for consistent cache management
- Export individual functions from utility modules

### Don't Do
- Don't use PascalCase for function or file names (except React components or exported types)
- Don't mix casing conventions within the same pattern
- Don't use abbreviations unless universally understood
- Don't hardcode time values (use `queryDefaults`)
- Don't create redundant wrapper types
- Don't use service object patterns (use individual exports)
- Don't create new query keys without adding to `queryKeys` factory
- Don't add Edge Functions without kebab-case folder naming

## Automated Enforcement & Linting

### Naming Pattern Regexes

**Edge Function folders** (must match):
```regex
^[a-z0-9]+(-[a-z0-9]+)*$
```
All lowercase, kebab-case, no spaces or capitals.

**Frontend utility files** (must match):
```regex
^[a-z][a-zA-Z0-9]*\.ts$|^[a-z]+-[a-z]+(-[a-z]+)*\.ts$
```
Either camelCase or kebab-case with `.ts` extension.

**React components** (must match):
```regex
^[A-Z][a-zA-Z0-9]*\.tsx$
```
PascalCase with `.tsx` extension.

**Hook files** (must match):
```regex
^use[A-Z][a-zA-Z0-9]*\.ts$|^use-[a-z]+(-[a-z]+)*\.ts$
```
Either `useCamelCase.ts` or `use-kebab-case.ts`.

### ESLint Integration

Use consistent query key patterns. Follow existing conventions in `TranscriptsTab.tsx` and `CallDetailDialog.tsx`.

## Common Patterns Reference

For implementation examples, see:
- **Edge Functions**: `supabase/functions/*/index.ts`
- **API Client**: `src/lib/api-client.ts`
- **Hooks**: `src/hooks/useMeetingsSync.ts`
- **Types**: `src/integrations/supabase/types.ts`

## See Also

Related documentation for complete pattern enforcement:
- **Brand Guidelines**: `BRAND_GUIDELINES.md` - Visual and UI naming conventions
- **Design Principles**: `docs/design/design-principles-conversion-brain.md` - Component design patterns
- **Supabase Types**: `src/integrations/supabase/types.ts` - Database type definitions
