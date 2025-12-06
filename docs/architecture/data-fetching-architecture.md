# Data Fetching Architecture - CallVault

## Overview

CallVault uses **TanStack Query v5** as the primary data fetching and caching layer. All server state flows through TanStack Query hooks, with mutations calling Supabase Edge Functions via a centralized API client.

## Core Components

### 1. Query Client Configuration
**Location**: `src/App.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 minute default
      gcTime: 5 * 60 * 1000,       // 5 minutes garbage collection
      refetchOnWindowFocus: false, // Disabled by default
      refetchOnReconnect: true,    // Enabled
      retry: 1,                    // Single retry
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 2. Query Key Conventions

Use **descriptive string array keys** following these patterns:

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

// Analytics with time range
queryKey: ["call-analytics", timeRange]
```

#### Naming Guidelines

1. **Use kebab-case** for multi-word keys (`"category-calls"`, not `"categoryCalls"`)
2. **Entity first** - Start with the entity name (`"call-transcripts"`, not `"transcripts-for-call"`)
3. **Include all filter parameters** - Ensures proper cache separation
4. **Keep arrays flat** when possible - Easier to invalidate

#### Invalidation Patterns

```typescript
// Invalidate all category-related queries
queryClient.invalidateQueries({ queryKey: ["categories"] });
queryClient.invalidateQueries({ queryKey: ["category-calls"] });
queryClient.invalidateQueries({ queryKey: ["category-assignments"] });

// Invalidate specific call data
queryClient.invalidateQueries({ queryKey: ["call-transcripts", recordingId] });
```

### 3. Caching Behavior

All queries use the **QueryClient defaults** configured in `src/App.tsx`:
- **staleTime**: 1 minute
- **gcTime**: 5 minutes
- **refetchOnWindowFocus**: disabled
- **retry**: 1 attempt with exponential backoff

Override these in individual queries only when specific behavior is needed (e.g., polling for real-time data).

## Current Usage Statistics

| Type | Count | Primary Locations |
|------|-------|-------------------|
| useQuery | 10 | TranscriptsTab (3), CallDetailDialog (5), SpeakerManagementDialog (1), useCallAnalytics (1) |
| useMutation | 12 | TranscriptsTab (3), CallDetailDialog (6), SpeakerManagementDialog (3) |
| Direct Supabase | ~11 | useMeetingsSync (~5), useCategorySync (~6) - technical debt, should be mutations |

## API Client Pattern

### Centralized Edge Function Caller
**Location**: `src/lib/api-client.ts`

```typescript
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export async function callEdgeFunction<T = any>(
  functionName: string,
  body?: any,
  options: { retry?: boolean; maxRetries?: number } = {}
): Promise<ApiResponse<T>> {
  const { retry = true, maxRetries = 3 } = options;

  const makeRequest = async () => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
      logger.error(`Edge function ${functionName} error`, error);
      throw error;
    }
    return data as T;
  };

  try {
    if (retry) {
      const data = await retryWithBackoff(makeRequest, maxRetries);
      return { data };
    } else {
      const data = await makeRequest();
      return { data };
    }
  } catch (error: any) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Failed to call ${functionName}`, error);
    return { error: errorMessage };
  }
}
```

### Available API Functions
**Location**: `src/lib/api-client.ts`

| Function | Edge Function | Purpose |
|----------|---------------|---------|
| `fetchMeetings(params)` | fetch-meetings | Get meetings from Fathom |
| `syncMeetings(recordingIds)` | sync-meetings | Sync meetings to DB |
| `fetchSingleMeeting(recordingId)` | fetch-single-meeting | Get single meeting |
| `testFathomConnection()` | test-fathom-connection | Test API connection |
| `saveFathomKey(apiKey)` | save-fathom-key | Save API key |
| `saveWebhookSecret(secret)` | save-webhook-secret | Save webhook secret |
| `saveHostEmail(email)` | save-host-email | Save host email |
| `getConfigStatus()` | get-config-status | Get configuration |
| `resyncAllCalls()` | resync-all-calls | Re-sync all calls |
| `deleteAllCalls()` | delete-all-calls | Delete all calls |
| `getFathomOAuthUrl()` | fathom-oauth-url | Get OAuth URL |
| `completeFathomOAuth(code, state)` | fathom-oauth-callback | Complete OAuth |
| `refreshFathomOAuth()` | fathom-oauth-refresh | Refresh tokens |
| `createFathomWebhook()` | create-fathom-webhook | Create webhook |

## Query Patterns

### Basic Query Pattern
**Example**: `src/components/transcripts/TranscriptsTab.tsx`

```typescript
const { data: categories = [], isLoading: categoriesLoading } = useQuery({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("call_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return data;
  },
});
```

### Dependent Query Pattern
**Example**: `src/components/transcripts/TranscriptsTab.tsx`

```typescript
const { data: categoryAssignments = {} } = useQuery({
  queryKey: ["category-assignments", calls.map((c) => c.recording_id)],
  queryFn: async () => {
    if (calls.length === 0) return {};

    const { data, error } = await supabase
      .from("call_category_assignments")
      .select("call_recording_id, category_id")
      .in("call_recording_id", calls.map((c) => c.recording_id));

    if (error) throw error;

    return data.reduce((acc, assignment) => {
      acc[assignment.call_recording_id] = assignment.category_id;
      return acc;
    }, {} as Record<number, string>);
  },
  enabled: calls.length > 0,
});
```

### Analytics Query Pattern
**Example**: `src/hooks/useCallAnalytics.ts`

```typescript
export function useCallAnalytics(timeRange: string = '30d') {
  return useQuery({
    queryKey: ['call-analytics', timeRange],
    queryFn: async (): Promise<CallAnalytics> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Multiple Supabase queries for analytics
      // Returns computed analytics object
    }
  });
}
```

## Mutation Patterns

### Standard Mutation with Cache Invalidation
**Example**: `src/components/transcripts/TranscriptsTab.tsx`

```typescript
const categorizeMutation = useMutation({
  mutationFn: async ({ callIds, categoryId }: { callIds: number[]; categoryId: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Remove existing assignments
    await supabase
      .from("call_category_assignments")
      .delete()
      .in("call_recording_id", callIds);

    // Create new assignments
    const assignments = callIds.map((callId) => ({
      call_recording_id: callId,
      category_id: categoryId,
      auto_assigned: false,
    }));

    const { error } = await supabase
      .from("call_category_assignments")
      .insert(assignments);

    if (error) throw error;
  },
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ["category-calls"] });
    queryClient.invalidateQueries({ queryKey: ["category-assignments"] });
    const count = variables.callIds.length;
    toast.success(`${count} transcript${count > 1 ? "s" : ""} categorized`);
    setSelectedCalls([]);
  },
  onError: () => {
    toast.error("Failed to categorize transcript(s)");
  },
});
```

### Delete Mutation with Multiple Table Cleanup
**Example**: `src/components/transcripts/TranscriptsTab.tsx`

```typescript
const deleteCallsMutation = useMutation({
  mutationFn: async (ids: number[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Delete from all related tables first
    const { error: assignmentsError } = await supabase
      .from("call_category_assignments")
      .delete()
      .in("call_recording_id", ids);
    if (assignmentsError) throw assignmentsError;

    // Then delete main records
    const { error } = await supabase
      .from("fathom_calls")
      .delete()
      .in("recording_id", ids)
      .eq("user_id", user.id);
    if (error) throw error;
  },
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ["category-calls"] });
    queryClient.invalidateQueries({ queryKey: ["category-assignments"] });
    toast.success(`${variables.length} transcript(s) deleted successfully`);
  },
  onError: (error: any) => {
    toast.error(`Failed to delete transcript(s): ${error.message || "Unknown error"}`);
  },
});
```

## Cache Invalidation Patterns

### Current Query Keys in Use

| Query Key | Used In | Purpose |
|-----------|---------|---------|
| `["categories"]` | TranscriptsTab | User's categories |
| `["category-calls"]` | TranscriptsTab | Calls with category |
| `["category-assignments"]` | TranscriptsTab | Category assignments |
| `["transcript-calls"]` | TranscriptsTab | All transcripts |
| `["calls-with-transcripts"]` | CallDetailDialog | Calls with full transcripts |
| `["call-transcripts", id]` | CallDetailDialog | Single call transcripts |
| `["call-categories", id]` | CallDetailDialog | Categories for call |
| `["call-tags", id]` | CallDetailDialog | Tags for call |
| `["call-speakers", id]` | CallDetailDialog | Speakers for call |
| `["speakers"]` | SpeakerManagementDialog | All speakers |
| `["user-settings"]` | CallDetailDialog | User settings |
| `["call-analytics", timeRange]` | useCallAnalytics | Analytics data |

### Invalidation Strategy

Mutations invalidate related query keys after successful operations:

```typescript
onSuccess: () => {
  // Invalidate all affected queries
  queryClient.invalidateQueries({ queryKey: ["category-calls"] });
  queryClient.invalidateQueries({ queryKey: ["category-assignments"] });

  // Show success toast
  toast.success("Operation completed");
}
```

## Error Handling

### Mutation Error Pattern

```typescript
onError: (error: any) => {
  toast.error(`Failed to perform action: ${error.message || "Unknown error"}`);
}
```

### Query Error Handling

Errors are handled through TanStack Query's built-in error states:
- `isError` flag for conditional rendering
- `error` object for error details
- Retry logic configured in QueryClient

## How to Add New Data Fetching

### 1. Adding a New Query

```typescript
// In your component or hook
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const { data, isLoading, error } = useQuery({
  // Use descriptive, hierarchical query key (hardcoded string array)
  // Follow existing patterns: ["feature-name"] or ["feature-name", id]
  queryKey: ["feature-name", param1, param2],

  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("table_name")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;
    return data;
  },

  // Note: Most queries rely on QueryClient defaults (1 min stale, 5 min gc)
  // Override only if needed for specific behavior
});
```

### 2. Adding a New Mutation

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: async (params: ParamsType) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("table_name")
      .insert(params);

    if (error) throw error;
  },

  onSuccess: () => {
    // Invalidate affected queries
    queryClient.invalidateQueries({ queryKey: ["affected-query"] });
    toast.success("Successfully created");
  },

  onError: (error: any) => {
    toast.error(`Failed: ${error.message || "Unknown error"}`);
  },
});
```

### 3. Adding Edge Function Call

```typescript
// 1. Add to src/lib/api-client.ts
export async function newFeatureAction(params: ParamsType) {
  return callEdgeFunction('new-edge-function', params);
}

// 2. Use in component/hook
import { newFeatureAction } from "@/lib/api-client";

const mutation = useMutation({
  mutationFn: async (params) => {
    const result = await newFeatureAction(params);
    if (result.error) throw new Error(result.error);
    return result.data;
  },
  // ... onSuccess, onError
});
```

## Automated Scans

### Find All TanStack Query Usage
```bash
grep -rn "useQuery\|useMutation\|useQueryClient" src/ --include="*.ts" --include="*.tsx"
```

### Find All Query Keys
```bash
grep -rn "queryKey:" src/ --include="*.ts" --include="*.tsx"
```

### Find All Cache Invalidations
```bash
grep -rn "invalidateQueries" src/ --include="*.ts" --include="*.tsx"
```

### Find Direct Supabase Queries (Outside TanStack Query)
```bash
grep -rn "supabase.from" src/ --include="*.ts" --include="*.tsx" | grep -v "useQuery\|useMutation"
```

### Find Manual Fetch Calls (Potential Anti-Pattern)
```bash
grep -rn "fetch(" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

### Find Stale Time Settings
```bash
grep -rn "staleTime" src/ --include="*.ts" --include="*.tsx"
```

## Best Practices

### Do's

1. **Use descriptive string array keys** (`["entity-name", param1, param2]`)
2. **Use kebab-case** for multi-word query keys
3. **Always check authentication** at the start of queryFn
4. **Invalidate related queries** after mutations
5. **Show toast notifications** for user feedback
6. **Handle errors** in both queries and mutations
7. **Use `enabled` flag** for dependent queries

### Don'ts

1. **Don't use manual fetch()** - Use TanStack Query
2. **Don't forget to invalidate** related queries after mutations
3. **Don't ignore errors** - Always show user feedback
4. **Don't use camelCase in query keys** - Use kebab-case (`"category-calls"` not `"categoryCalls"`)
5. **Don't skip authentication checks** in queryFn
6. **Don't create duplicate queries** for same data
7. **Don't poll without good reason** - Use refetchInterval sparingly


## Migration Notes

### Deprecated Patterns (Removed)

The codebase has been cleaned of legacy patterns:
- No manual polling hooks (`usePolling`)
- No custom ETag caching layer
- No Socket.IO connections
- No manual cache management

### Current Architecture

- All data fetching through TanStack Query
- Browser handles HTTP caching (ETags on backend)
- Smart polling only for real-time sync jobs
- Centralized API client for Edge Functions

## Performance Optimizations

### Query Deduplication
TanStack Query automatically deduplicates requests with the same query key.

### Stale-While-Revalidate
Default behavior: serve stale data while fetching fresh data in background.

### Garbage Collection
Unused queries are removed after gcTime (default: 5 minutes).

### Retry Logic
Failed queries retry once with exponential backoff (max 30 seconds).

## Future Considerations

- Server-Sent Events for true real-time updates
- Optimistic updates with rollback for better UX
- GraphQL for selective field queries
- Query prefetching for anticipated navigation

## Related Documentation

- **API Naming Conventions**: `docs/architecture/api-naming-conventions.md`
- **Architecture**: `docs/architecture/architecture.md`
- **Brand Guidelines**: `docs/design/brand-guidelines-v3.3.md`
