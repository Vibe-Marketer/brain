# YouTube Import Debug Report
**Date:** 2025-02-14  
**Repo:** /Users/admin/repos/brain (dev branch)  
**Status:** Analysis Complete

---

## Executive Summary

The YouTube import feature in CallVault has a **well-architected pipeline** but several **potential failure points** have been identified. The system is designed with proper fallback mechanisms, but lacks comprehensive error logging and monitoring in production.

### Key Findings:
1. ✅ **Architecture is solid** - Multi-step pipeline with fallback mechanisms
2. ⚠️  **Missing production monitoring** - No centralized error tracking
3. ⚠️  **API dependency risks** - Both YouTube Data API and Transcript API can fail silently
4. ⚠️  **Limited error surface exposure** - Errors may be swallowed in fallback logic
5. ✅ **Good test coverage** - Regression tests exist for core failure scenarios

---

## Pipeline Architecture

### Full Import Flow

```
User Input (URL)
    ↓
Frontend: YouTubeImportForm.tsx
    ↓ (supabase.functions.invoke)
Edge Function: youtube-import/index.ts
    ↓
┌─────────────────────────────────┐
│ Step 1: URL Validation          │
│  - Extract video ID             │
│  - Validate format              │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Step 2: Duplicate Check         │
│  - Query fathom_calls by ID     │
│  - Return existing if found     │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Step 3: YouTube Vault Setup     │
│  - Find/create YouTube vault    │
│  - Best effort (non-blocking)   │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Step 4: Fetch Video Details     │
│  → youtube-api function         │
│  → YouTube Data API v3          │
│  ⚠️ FALLBACK: Use transcript    │
│     metadata if this fails      │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Step 5: Fetch Transcript        │
│  → Transcript API (direct)      │
│  → transcriptapi.com/api/v2     │
│  ❌ FATAL if this fails         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Step 6: Create fathom_calls     │
│  - Insert into database         │
│  - Generate recording_id        │
│  - Store metadata as JSONB      │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Step 7: Create recordings entry │
│  - Link to YouTube vault        │
│  - Create vault_entry           │
│  ⚠️ Best effort (non-blocking)  │
└─────────────────────────────────┘
    ↓
Success Response
```

### Key Components

| Component | Path | Purpose |
|-----------|------|---------|
| **Frontend Form** | `src/components/import/YouTubeImportForm.tsx` | User input, progress UI |
| **Import Function** | `supabase/functions/youtube-import/index.ts` | Main orchestration |
| **YouTube API** | `supabase/functions/youtube-api/index.ts` | Video metadata fetching |
| **Types** | `src/types/youtube.ts` | TypeScript interfaces |
| **Utils** | `src/lib/youtube-utils.ts` | Duration parsing, formatting |
| **Tests** | `supabase/functions/youtube-import/__tests__/` | Regression coverage |

---

## Identified Failure Points

### 🔴 **CRITICAL: Transcript API Dependency**

**File:** `supabase/functions/youtube-import/index.ts:639-704`

**Issue:**
- The entire import **fails fatally** if Transcript API fails
- No retry logic
- No alternative transcript sources
- API could be rate-limited, down, or video could lack captions

**Evidence:**
```typescript
const transcriptResponse = await fetch(transcriptUrl.toString(), {
  headers: {
    Authorization: `Bearer ${transcriptApiKey}`,
  },
});

if (!transcriptResponse.ok) {
  console.error('[youtube-import] downstream transcript api failure', {
    stage: 'transcript',
    downstreamStatus: transcriptResponse.status,
    responseBody: typeof transcriptRaw === 'string' ? transcriptRaw.slice(0, 500) : 'empty',
  });
  return createDownstreamFailureResponse(
    'transcripts-api',
    'transcript',
    'transcribing',
    transcriptResponse.status,
    'transcripts-api transcript stage failed',
    corsHeaders,
    transcriptPayload,
  );
}
```

**Failure Scenarios:**
1. Video has no captions available
2. Transcript API rate limit exceeded
3. Transcript API service outage
4. Invalid API key
5. Network timeout

**Recommended Fix:**
```typescript
// Add retry logic with exponential backoff
async function fetchTranscriptWithRetry(url, apiKey, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      
      if (response.ok) return response;
      
      // Don't retry on 4xx errors (except 429 rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
}

// Alternative: Fall back to YouTube's auto-generated captions via youtube-transcript library
// Or allow import without transcript (mark as "transcript pending")
```

---

### 🟡 **MEDIUM: YouTube Data API Failures Silently Degrade**

**File:** `supabase/functions/youtube-import/index.ts:607-636`

**Issue:**
- Video details fetch failures are logged but not surfaced to user
- Falls back to transcript metadata silently
- User has no visibility into degraded data quality

**Evidence:**
```typescript
try {
  const detailsResponse = await fetch(`${supabaseUrl}/functions/v1/youtube-api`, {
    method: 'POST',
    headers: youtubeApiHeaders,
    body: JSON.stringify({
      action: 'video-details',
      params: { videoId },
    }),
  });

  // ... validation ...
  
} catch (detailsError) {
  console.warn('[youtube-import] video-details fetch failed; falling back to transcript metadata', detailsError);
}
```

**Impact:**
- Missing view counts, like counts, category info
- Incomplete metadata in recordings table
- User doesn't know data is incomplete

**Recommended Fix:**
```typescript
// Track metadata source and surface in UI
const metadata = {
  youtube_video_id: videoId,
  metadata_source: videoDetails ? 'youtube_data_api' : 'transcript_api_fallback',
  metadata_quality: videoDetails ? 'complete' : 'partial',
  // ... rest of metadata
};

// Add warning to response
if (!videoDetails) {
  response.warnings = ['Video metadata incomplete - using transcript fallback'];
}
```

---

### 🟡 **MEDIUM: Vault Auto-Creation Can Fail Silently**

**File:** `supabase/functions/youtube-import/index.ts:561-606`

**Issue:**
- Vault creation wrapped in try/catch that swallows errors
- Import succeeds even if vault linkage fails
- Videos imported without proper organization

**Evidence:**
```typescript
try {
  // ... vault creation logic ...
} catch (vaultSetupError) {
  // Never block import on vault auto-creation failures
  console.error('Error in YouTube vault auto-creation:', vaultSetupError);
}
```

**Impact:**
- Videos might not appear in expected vault
- User confusion about where imports went
- Broken vault_entries relationships

**Recommended Fix:**
```typescript
// Still don't block import, but track the failure
const vaultSetupResult = {
  vaultId: null,
  error: null as string | null,
};

try {
  // ... vault creation logic ...
  vaultSetupResult.vaultId = youtubeVaultId;
} catch (vaultSetupError) {
  vaultSetupResult.error = vaultSetupError.message;
  console.error('Error in YouTube vault auto-creation:', vaultSetupError);
}

// Include in response
response.vaultSetupStatus = vaultSetupResult.vaultId 
  ? 'success' 
  : vaultSetupResult.error 
    ? 'failed' 
    : 'skipped';
```

---

### 🟡 **MEDIUM: Recordings Table Entry Failures**

**File:** `supabase/functions/youtube-import/index.ts:764-875`

**Issue:**
- Recordings table insert wrapped in try/catch
- Failures don't block import
- Results in orphaned fathom_calls records

**Evidence:**
```typescript
try {
  // Create recording directly in recordings table
  const { data: newRecording, error: recordingInsertError } = await supabase
    .from('recordings')
    .insert({ ... })
    .select('id')
    .single();

  if (recordingInsertError) {
    console.error('Error creating recording:', recordingInsertError);
  }
} catch (recordingError) {
  // Never block import on recording table failures
  console.error('Error creating recording entry:', recordingError);
}
```

**Impact:**
- fathom_calls exists but recordings doesn't
- Data inconsistency between tables
- Features relying on recordings table fail

**Recommended Fix:**
```typescript
// Track recording creation status
const recordingStatus = {
  created: false,
  recordingId: null,
  error: null,
};

try {
  const { data: newRecording, error: recordingInsertError } = await supabase
    .from('recordings')
    .insert({ ... })
    .select('id')
    .single();

  if (recordingInsertError) {
    recordingStatus.error = recordingInsertError.message;
    console.error('Error creating recording:', recordingInsertError);
  } else if (newRecording) {
    recordingStatus.created = true;
    recordingStatus.recordingId = newRecording.id;
  }
} catch (recordingError) {
  recordingStatus.error = recordingError.message;
  console.error('Error creating recording entry:', recordingError);
}

// Include in response for monitoring
response.recordingStatus = recordingStatus;
```

---

### 🟢 **LOW: URL Validation Could Be More Robust**

**File:** `src/components/import/YouTubeImportForm.tsx:41-80`

**Issue:**
- Frontend validation is basic regex matching
- Some edge cases might slip through (playlists, shorts, embeds with timestamps)
- Backend validation mirrors frontend (good for consistency)

**Current Validation:**
```typescript
function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  
  // Check if it's a direct video ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try various URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // ...
  ];
  
  // ...
}
```

**Missing Cases:**
- `https://www.youtube.com/watch?v=VIDEO_ID&t=30s` (with timestamp)
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID` (mobile)
- `https://youtube.com/live/VIDEO_ID` (live streams)

**Recommended Fix:**
```typescript
// More comprehensive video ID extraction
const patterns = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/, // Add shorts
  /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/, // Add live
  /(?:m\.youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/, // Mobile
];

// Strip query params and anchors before matching
const cleanUrl = trimmed.split(/[?#]/)[0];
```

---

### 🟢 **LOW: Simulated Progress May Confuse Users**

**File:** `src/components/import/YouTubeImportForm.tsx:122-145`

**Issue:**
- Frontend simulates multi-step progress with timers
- Backend is a single request
- If backend completes quickly, UI might still show earlier steps

**Evidence:**
```typescript
// Simulate multi-step progress while waiting for the single-request edge function.
const progressSteps: { step: ImportStep; delay: number }[] = [
  { step: 'checking', delay: 800 },
  { step: 'fetching', delay: 1800 },
  { step: 'transcribing', delay: 4000 },
  { step: 'processing', delay: 8000 },
];

let cancelled = false;
const timeoutIds: ReturnType<typeof setTimeout>[] = [];

for (const { step, delay } of progressSteps) {
  const id = setTimeout(() => {
    if (!cancelled) setCurrentStep(step);
  }, delay);
  timeoutIds.push(id);
}
```

**Impact:**
- Progress bar might be misleading
- User might think process is slower than it is
- Or faster (backend fails before UI catches up)

**Recommended Fix:**
```typescript
// Option 1: Use actual step data from backend if available
// Backend would need to stream or send incremental updates

// Option 2: Simplify to single "Importing..." state
setCurrentStep('importing');

// Option 3: Show indeterminate progress bar
<Progress value={undefined} className="animate-pulse" />
```

---

## Error Handling Analysis

### Current Error Logging

The code has **33 console.log/error/warn statements**, which is good for debugging but:
- No centralized error tracking (Sentry, LogRocket, etc.)
- Errors logged to console may not surface in production
- No error metrics or alerting

**Example logging:**
```typescript
console.error('[youtube-import] downstream transcript api failure', {
  stage: 'transcript',
  downstreamStatus: transcriptResponse.status,
  responseBody: typeof transcriptRaw === 'string' ? transcriptRaw.slice(0, 500) : 'empty',
});
```

### Error Response Handling

✅ **Good:** Structured error responses with step information
```typescript
interface ImportResponse {
  success: boolean;
  step: ImportStep;
  error?: string;
  recordingId?: number;
  title?: string;
  exists?: boolean;
}
```

⚠️ **Issue:** Frontend only shows generic error message to user
```typescript
if (data.error) {
  setError(data.error);
  setCurrentStep('error');
  onError(data.error);
}
```

---

## Testing Coverage

### Existing Tests

**File:** `supabase/functions/youtube-import/__tests__/youtube-import-regression.test.ts`

✅ Tests verify:
- Downstream status preservation for video-details failures
- Downstream status preservation for transcript failures
- User JWT forwarding to youtube-api
- Direct Transcript API fetching

**Coverage:**
- ✅ Response structure validation
- ✅ Error handling code paths exist
- ❌ No actual integration tests with real APIs
- ❌ No edge case testing (invalid URLs, missing captions, etc.)
- ❌ No vault creation testing

### Missing Tests

1. **Integration Tests:**
   - Actual YouTube video import end-to-end
   - API failure simulation (mock responses)
   - Vault auto-creation flow
   - Duplicate detection

2. **Edge Cases:**
   - Private videos
   - Age-restricted videos
   - Videos without captions
   - Deleted/unavailable videos
   - Regional restrictions

3. **Performance Tests:**
   - Long videos (2+ hours)
   - Concurrent imports
   - Database transaction rollback on failures

---

## Configuration Issues

### API Keys

✅ **Configured in .env:**
```bash
YOUTUBE_DATA_API_KEY="AIzaSyB-5OHLyCWibnpkO5-cIUh5ZBvsdCAq75E"
TRANSCRIPT_API_KEY="sk_qIg9PTc9bkTSPbsWK-y-p455ljszZ-M6GMMHijsNGr0"
```

⚠️ **Potential Issues:**
- No validation that keys are active
- No quota monitoring
- Keys visible in .env (should be in Supabase Secrets)

### Secret Management

Current approach:
```typescript
const youtubeApiKey = normalizeSecret(Deno.env.get('YOUTUBE_DATA_API_KEY'));
const transcriptApiKey = normalizeSecret(Deno.env.get('TRANSCRIPT_API_KEY'));
```

**Recommendation:**
- Move keys to Supabase Dashboard > Edge Functions > Secrets
- Add key rotation reminders
- Monitor API usage/quotas

---

## User Experience Issues

### 1. Limited Error Feedback

**Current:**
```typescript
toast.error('Import failed', {
  description: error,
});
```

**Issues:**
- Generic "Import failed" message
- No actionable guidance
- No indication of retry-ability

**Recommended:**
```typescript
// Map error types to user-friendly messages
const errorMessages = {
  'transcripts-api transcript stage failed': {
    title: 'Transcript Unavailable',
    description: 'This video doesn\'t have captions available. Try a different video.',
    action: null,
  },
  'Video already imported': {
    title: 'Already Imported',
    description: 'This video is already in your library.',
    action: { label: 'View Video', onClick: () => navigate(`/call/${recordingId}`) },
  },
  'Unauthorized': {
    title: 'Session Expired',
    description: 'Please log in again to continue.',
    action: { label: 'Log In', onClick: () => navigate('/login') },
  },
  // ... more cases
};
```

### 2. No Import History

- Users can't see past imports
- No way to retry failed imports
- No visibility into why an import failed

**Recommended:**
- Add import history table/view
- Store failure reasons
- Allow retry with original parameters

### 3. Missing Progress Indicators

- No indication of which step actually failed
- User doesn't know if they should wait or give up
- No estimated time remaining

---

## Database Schema Considerations

### Potential Issues

1. **Recording ID Generation:**
   ```typescript
   function generateYouTubeRecordingId(): number {
     const base = 9000000000000;
     const timestamp = Date.now();
     return base + timestamp;
   }
   ```
   - Could theoretically collision if two imports happen in same millisecond
   - Better to use database sequences or UUIDs

2. **JSONB Metadata:**
   - Good use of JSONB for flexible metadata
   - But no schema validation
   - Fields could be inconsistent

3. **Orphaned Records:**
   - If recordings insert fails, fathom_calls is orphaned
   - No cleanup mechanism
   - Could lead to data bloat

---

## Recommendations Summary

### 🔴 **P0: Critical Fixes**

1. **Add Transcript API Retry Logic** *(Priority: CRITICAL)*
   - Implement exponential backoff
   - Add timeout handling
   - Consider alternative transcript sources

2. **Centralized Error Tracking** *(Priority: HIGH)*
   - Integrate Sentry or equivalent
   - Log all import attempts with outcomes
   - Set up alerts for failure rate > 10%

3. **Improve User Error Messages** *(Priority: HIGH)*
   - Map error codes to user-friendly messages
   - Provide actionable next steps
   - Show retry option for transient failures

### 🟡 **P1: Important Improvements**

4. **Vault Creation Monitoring** *(Priority: MEDIUM)*
   - Track vault setup failures
   - Alert on recurring issues
   - Add manual vault assignment option

5. **Recordings Table Consistency** *(Priority: MEDIUM)*
   - Ensure fathom_calls and recordings stay in sync
   - Add database constraints/triggers
   - Implement cleanup for orphaned records

6. **API Key Management** *(Priority: MEDIUM)*
   - Move to Supabase Secrets
   - Add quota monitoring
   - Implement key rotation

### 🟢 **P2: Nice-to-Have**

7. **Enhanced URL Validation** *(Priority: LOW)*
   - Support more YouTube URL formats
   - Handle edge cases (shorts, live, mobile)
   - Add URL preview before import

8. **Progress Indicator Accuracy** *(Priority: LOW)*
   - Use real backend progress if available
   - Or switch to indeterminate spinner
   - Remove simulated delays

9. **Comprehensive Testing** *(Priority: LOW)*
   - Add integration tests
   - Test edge cases
   - Performance testing for large videos

---

## Testing Recommendations

### Manual Test Cases

Test these scenarios to verify current behavior:

1. **Happy Path:**
   - Standard YouTube URL with captions
   - Short URL (youtu.be)
   - Direct video ID

2. **Error Cases:**
   - Private video
   - Deleted video
   - Video without captions
   - Already imported video
   - Invalid URL format

3. **Edge Cases:**
   - Very long video (2+ hours)
   - Video with auto-generated captions only
   - Age-restricted video
   - Regional restrictions

4. **Performance:**
   - Import 5 videos simultaneously
   - Import immediately after previous import
   - Import while network is slow

### Automated Test Script

```typescript
// test-youtube-import.ts
import { createClient } from '@supabase/supabase-js';

const testCases = [
  { 
    name: 'Valid video with captions',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    expectedSuccess: true,
  },
  {
    name: 'Short URL format',
    url: 'https://youtu.be/dQw4w9WgXcQ',
    expectedSuccess: true,
  },
  {
    name: 'Direct video ID',
    url: 'dQw4w9WgXcQ',
    expectedSuccess: true,
  },
  {
    name: 'Invalid URL',
    url: 'https://notayoutube.com/watch?v=invalid',
    expectedSuccess: false,
  },
  // Add more cases
];

async function runTests() {
  for (const test of testCases) {
    console.log(`Testing: ${test.name}`);
    // ... test logic
  }
}
```

---

## Monitoring Dashboard Recommendations

### Key Metrics to Track

1. **Import Success Rate**
   - Target: > 95%
   - Alert if < 90% for 1 hour

2. **Import Duration**
   - P50: < 10 seconds
   - P95: < 30 seconds
   - Alert if P95 > 60 seconds

3. **API Failure Rates**
   - YouTube Data API failures: < 5%
   - Transcript API failures: < 10%

4. **Vault Creation Success**
   - Should be near 100% after first import
   - Alert on failures

5. **Database Write Failures**
   - fathom_calls insert: < 0.1%
   - recordings insert: < 1%

### Example Query for Monitoring

```sql
-- Import success rate by day
SELECT 
  DATE(created_at) as import_date,
  COUNT(*) as total_imports,
  SUM(CASE WHEN source_platform = 'youtube' THEN 1 ELSE 0 END) as youtube_imports,
  AVG(CASE WHEN full_transcript IS NOT NULL THEN 1 ELSE 0 END) as success_rate
FROM fathom_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY import_date DESC;
```

---

## Conclusion

The YouTube import feature is **architecturally sound** with good separation of concerns and fallback mechanisms. However, the "not 100% working" issue likely stems from:

1. **Transcript API failures** (most likely culprit)
   - Videos without captions
   - API rate limits
   - Service availability

2. **Silent degradation** in vault/recordings creation
   - Imports succeed at fathom_calls level
   - But fail to appear in expected UI locations

3. **Lack of visibility** into failures
   - Users see generic errors
   - No logging/monitoring in production
   - Can't diagnose root cause

### Next Steps

1. **Immediate:** Add comprehensive logging to production
2. **Short-term:** Implement P0 fixes (retry logic, error messages)
3. **Medium-term:** Add monitoring dashboard
4. **Long-term:** Comprehensive testing and alternative transcript sources

The codebase is well-structured and ready for these improvements without major refactoring.
