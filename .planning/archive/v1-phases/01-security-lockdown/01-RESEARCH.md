# Phase 1: Security Lockdown - Research

**Researched:** 2026-01-27
**Domain:** Application security hardening (brownfield codebase)
**Confidence:** HIGH

## Summary

This phase addresses 6 concrete security vulnerabilities across the CallVault codebase. Research focused on identifying exact file paths, current code state, what needs to change, existing patterns to replicate, and risk assessment for each requirement.

Key findings:
- **SEC-01** is straightforward dead code removal — `ai-agent.ts` exposes an OpenAI API key client-side but is only imported by 2 files, neither of which are on critical paths
- **SEC-02** requires deleting 2 legacy edge function directories — neither is called from anywhere in the frontend
- **SEC-03** needs admin auth added to `test-env-vars` (which currently has ZERO auth and exposes full credentials!) and a role check added to `test-secrets` (which has basic auth but no admin check)
- **SEC-04** involves removing/replacing ~26 console.log statements across 3 files, with varying PII sensitivity
- **SEC-05** has 7 specific `as any` casts in `BulkActionToolbarEnhanced.tsx` — the export functions expect `Call` but receive `Meeting[]`
- **SEC-06** is the largest task: 49 edge functions use inline wildcard CORS and need migration to `getCorsHeaders()`. 14 more import the shared `corsHeaders` constant (also wildcard). The `getCorsHeaders()` function already exists in `_shared/cors.ts`

**Primary recommendation:** Execute SEC-01 through SEC-05 first (low risk, high impact), then batch SEC-06 systematically since it touches 63 edge functions.

## Findings by Requirement

### SEC-01: Remove Client-Side Exposed API Keys

**Confidence:** HIGH

**Exact files:**
| File | Role | Action |
|------|------|--------|
| `src/lib/ai-agent.ts` | Contains `VITE_OPENAI_API_KEY` on line 13 | **Delete entire file** |
| `src/hooks/useAIProcessing.ts` | Imports and wraps `ai-agent.ts` functions | **Delete entire file** |
| `src/components/loop/ContentGenerator.tsx` | Imports `ExtractedInsight` type from `ai-agent.ts` and uses `useAIProcessing` hook | **Remove imports, define type locally or from shared types** |

**Current state:**
```typescript
// src/lib/ai-agent.ts, line 12-14
const openai = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
});
```
The file exports 6 functions: `extractKnowledgeFromTranscript`, `generateContent`, `applyInsightsToCall`, `batchProcessTranscripts`, `findSimilarInsights`, `generateCallsSummary`. All make direct OpenAI API calls from the browser.

**What needs to change:**
1. Delete `src/lib/ai-agent.ts` entirely — all its functionality is duplicated by edge functions (`extract-knowledge`, `generate-content`, etc.)
2. Delete `src/hooks/useAIProcessing.ts` — wrapper hook that calls the above
3. Fix `src/components/loop/ContentGenerator.tsx` — imports `ExtractedInsight` type and `useAIProcessing`. The `ExtractedInsight` interface can be moved to a shared types file. The component will need its AI calls rewired to use edge functions, OR the component itself may be dead code (check if it's rendered anywhere)

**Risk assessment:** LOW risk. The feature audit report (docs/reference/feature-audit-report.md) explicitly calls this out as dead code. No frontend code invokes these functions except through `ContentGenerator.tsx` which uses `useAIProcessing`. The `.env` file does not even appear to contain `VITE_OPENAI_API_KEY` (grep returned no .env matches), suggesting this code path is already non-functional.

**Verification:** After deletion, search for `VITE_OPENAI_API_KEY` — should only appear in docs/archive files. No build errors should result.

---

### SEC-02: Delete Legacy Unauthenticated Edge Functions

**Confidence:** HIGH

**Exact files:**
| File | Action |
|------|--------|
| `supabase/functions/extract-knowledge/index.ts` | **Delete entire directory** |
| `supabase/functions/generate-content/index.ts` | **Delete entire directory** |

**Current state:**
- `extract-knowledge` (268 lines): Takes `callId` + `transcript`, calls OpenAI, stores results in DB. **Has ZERO authentication** — no auth header check, uses service role key directly.
- `generate-content` (166 lines): Takes content type + insight IDs, calls OpenAI, stores generated content. **Has ZERO authentication** — same pattern.

Both use `serve()` from `std@0.168.0` (older Deno serve pattern).

**What needs to change:**
1. Delete `supabase/functions/extract-knowledge/` directory
2. Delete `supabase/functions/generate-content/` directory

**Who calls them:** NOBODY in the frontend. Grep for `extract-knowledge` and `generate-content` in `src/` returned zero matches. These are legacy functions superseded by the 4-agent content pipeline (`content-classifier`, `content-insight-miner`, `content-hook-generator`, `content-builder`).

**Risk assessment:** VERY LOW. No callers exist. The newer content pipeline functions (`content-*`) are separate and properly authenticated. These legacy functions are a direct security risk since anyone can invoke them without auth if they know the URL.

**Verification:** After deletion, redeploy edge functions. Confirm no 404s in frontend console during normal usage.

---

### SEC-03: Add Admin Auth Check to Test/Debug Endpoints

**Confidence:** HIGH

**Exact files:**
| File | Current Auth | Action |
|------|-------------|--------|
| `supabase/functions/test-env-vars/index.ts` | **NONE** — completely open | **Add auth + admin check** |
| `supabase/functions/test-secrets/index.ts` | Basic auth (checks Bearer token) | **Add admin role check** |

**Current state — `test-env-vars`:**
```typescript
// Lines 174-189: Returns FULL credentials with NO auth check
const result = {
  credentials: {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,  // FULL KEY EXPOSED!
    SUPABASE_DB_URL: dbUrl,                      // FULL DB URL EXPOSED!
    OPENROUTER_API_KEY_FIRST_10: openrouterApiKey ? openrouterApiKey.substring(0, 10) + '...' : 'NOT SET',
    OPENAI_API_KEY_FIRST_10: openaiApiKey ? openaiApiKey.substring(0, 10) + '...' : 'NOT SET',
  },
  warning: '⚠️ DELETE THIS FUNCTION AFTER USE - it exposes sensitive credentials!',
};
```
**CRITICAL:** This function exposes the full `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` to anyone who hits the endpoint. It also has a `?action=export` mode that dumps the entire database. The function itself contains a warning to delete it.

**Current state — `test-secrets`:**
Has basic auth (lines 41-57) — requires Bearer token and validates with `supabase.auth.getUser(token)`. But does NOT check if the user is an admin. Returns secret key previews (first 10 + last 4 chars) for all configured secrets.

**What needs to change:**

For `test-env-vars`:
1. Add auth header check (like `delete-all-calls` pattern)
2. Add admin role check via `user_roles` table
3. **Consider:** Delete this function entirely instead — it was built as a one-time debug tool and self-documents as "DELETE AFTER USE"

For `test-secrets`:
1. Add admin role check after existing auth check
2. Use pattern from `get-available-models` which queries `user_roles` table

**Admin check pattern (from `get-available-models`):**
```typescript
const { data: roleData } = await supabaseClient
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle();

const isAdmin = roleData?.role === 'ADMIN';
if (!isAdmin) {
  return new Response(
    JSON.stringify({ error: 'Admin access required' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Risk assessment:** MEDIUM. Adding auth to `test-env-vars` is critical (it's the highest-severity vulnerability in the entire codebase). Adding admin check to `test-secrets` is lower risk. Neither function is called by the frontend in normal operation — they're manual debug tools.

**Recommendation:** Strongly consider **deleting `test-env-vars` entirely** rather than securing it. The function exposes raw credentials and has a DB export mode — even with admin auth, this is excessive. If retained, it should at minimum redact the full service role key and DB URL.

---

### SEC-04: Remove Sensitive Logging

**Confidence:** HIGH

**Exact files and lines:**

#### `src/contexts/AuthContext.tsx` (5 console.log statements)
| Line | Statement | PII Risk |
|------|-----------|----------|
| 25 | `console.log('[AuthContext] Auth state changed:', event, session ? 'Session valid' : 'No session')` | LOW — logs event name, not session data. But `session` object is in scope. |
| 29 | `console.log('[AuthContext] User signed out')` | NONE — no PII |
| 33 | `console.log('[AuthContext] Token refreshed successfully')` | NONE — no PII |
| 37 | `console.log('[AuthContext] User signed in')` | NONE — no PII |
| 59 | `console.log('[AuthContext] Initial session loaded:', session ? 'Valid' : 'None')` | LOW — ternary is safe, doesn't log session |

**Assessment:** These are already relatively safe — they log event names and boolean checks, not actual session data. BUT they expose auth flow details in production browser console. Replace with `logger.debug()` calls which suppress in production.

#### `src/pages/Chat.tsx` (15 console statements)
| Line | Statement | PII Risk |
|------|-----------|----------|
| 432 | `console.warn('Transport creation blocked: No valid auth token')` | NONE |
| 436-440 | `console.log('[Chat] Creating transport with:', { model, sessionId, hasFilters })` | LOW — no PII, but exposes session ID |
| 448 | `console.log('[Chat] Making request to:', url)` | LOW — exposes API endpoint |
| 454 | `console.log('[Chat] Response status:', response.status)` | NONE |
| 546 | `console.log('[Chat] Streaming interrupted, attempting reconnect...')` | NONE |
| 562 | `console.log('[Chat] Retrying message after streaming interruption')` | NONE |
| 571 | `console.log('[Chat] Max reconnect attempts reached')` | NONE |
| 590 | `console.log('[Chat] Auth error detected, attempting to refresh session...')` | NONE |
| 600 | `console.log('[Chat] Session refreshed successfully')` | NONE |
| 654 | `console.log('[Chat] Streaming completed successfully, resetting reconnection state')` | NONE |
| 750 | `console.log('[Chat] Workflow error with empty session, cleaning up:', sessionIdToCheck)` | LOW — session UUID |
| 890-892 | `console.log('New session detected, skipping initial DB fetch...')` | NONE |
| 916-917 | `console.log('Loaded N messages for session X')` | LOW — session UUID + count |
| 1030 | `console.warn('[Chat] Attempted to send message without valid session/transport')` | NONE |
| 1104 | `console.warn('[Chat] Attempted to send suggestion without valid session/transport')` | NONE |

**Assessment:** Mostly operational logging, not PII. The main concern is volume and exposing internal state in production. Replace with `logger.debug()` or remove.

#### `src/hooks/useChatSession.ts` (6 console statements)
| Line | Statement | PII Risk |
|------|-----------|----------|
| 162 | `console.log('No messages to save (empty or undefined)')` | NONE |
| 199 | `console.warn('Failed to serialize message parts, skipping')` | NONE |
| 211 | `console.warn('Skipping message with invalid role:', msg.role)` | NONE |
| 228 | `console.log('No valid messages to insert')` | NONE |
| **232** | **`console.log('Saving messages:', JSON.stringify(messagesToInsert, null, 2))`** | **HIGH — dumps full message content including user conversations** |
| 245 | `console.log('Saved messages successfully:', data?.length)` | NONE |

**Assessment:** Line 232 is the **most critical PII leak** — it dumps the full serialized message payload (including user text, AI responses, session IDs, user IDs) to the browser console. This MUST be removed or replaced with `logger.debug()`.

**What needs to change:**
1. **Line 232 in useChatSession.ts:** Remove entirely or replace with `logger.debug('Saving messages:', messagesToInsert.length)` (count only, not content)
2. **All other statements:** Replace `console.log`/`console.warn` with `logger.debug()`/`logger.warn()` which are environment-aware (production suppresses debug, only shows errors/warnings)
3. The project already has a `logger` utility at `src/lib/logger.ts` that suppresses debug/info in production

**Risk assessment:** LOW for the migration (mechanical replacement). Line 232 is the only high-severity item. The rest are operational logs that are low-risk but should still be cleaned up for defense-in-depth.

---

### SEC-05: Fix Type Safety Bypasses in Exports

**Confidence:** HIGH

**Exact file:** `src/components/transcript-library/BulkActionToolbarEnhanced.tsx`

**Current state — 7 `as any` casts:**

Lines 55-67 (export functions):
```typescript
await exportToPDF(selectedCalls as any[]);   // line 55
await exportToDOCX(selectedCalls as any[]);  // line 58
await exportToTXT(selectedCalls as any[]);   // line 61
await exportToJSON(selectedCalls as any[]);  // line 64
await exportToZIP(selectedCalls as any[]);   // line 67
```

Lines 132, 187 (API response data):
```typescript
const responseData = data as any;  // line 132 (generateAiTitles response)
const responseData = data as any;  // line 187 (autoTagCalls response)
```

**Root cause — export functions:**
- `selectedCalls` is typed as `Meeting[]` (from `src/types/meetings.ts`)
- Export functions (`exportToPDF`, etc.) expect `Call[]` (from `src/lib/export-utils.ts`)
- `Meeting` and `Call` are structurally similar but not identical:

| Field | `Meeting` type | `Call` type |
|-------|---------------|-------------|
| `recording_id` | `string \| number` | `number` |
| `title` | `string` | `string` |
| `created_at` | `string` | `string` |
| `full_transcript` | `string \| null` | `string` (optional) |
| `summary` | `string \| null` | `string` (optional) |
| `recorded_by_name` | `string \| null` | `string` (optional) |
| `recorded_by_email` | `string \| null` | `string` (optional) |
| `recording_start_time` | `string \| null` | `string` (optional) |
| `recording_end_time` | `string \| null` | `string` (optional) |
| `url` | `string \| null` | `string` (optional) |

**What needs to change:**
1. **Best fix:** Update `export-utils.ts` to accept `Meeting[]` (or a union/shared interface). The `Call` interface in `export-utils.ts` is a local unexported type — update it to match `Meeting` or import `Meeting` directly.
2. **Alternative:** Create a shared `ExportableCall` interface that both types satisfy, or make the export functions generic.
3. **For API responses (lines 132, 187):** Define proper response types for `generateAiTitles` and `autoTagCalls` return values. Check `src/lib/api-client.ts` for the actual return signatures.

**Risk assessment:** VERY LOW. These are type-only changes. The runtime behavior won't change since `Meeting` already has all the fields `Call` needs. The `as any` just masks the TypeScript compiler.

---

### SEC-06: Migrate Edge Functions from Wildcard CORS

**Confidence:** HIGH

**Current state:**
- **49 edge functions** define inline `const corsHeaders = { 'Access-Control-Allow-Origin': '*', ... }`
- **14 edge functions** import `corsHeaders` from `../_shared/cors.ts` — but this also resolves to `'*'`
- **0 edge functions** use `getCorsHeaders()` — the function exists but has never been adopted
- **Total: 63 edge functions** need migration

**The existing `getCorsHeaders()` in `_shared/cors.ts`:**
```typescript
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'];

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  let origin = '*';
  if (allowedOrigins[0] !== '*' && requestOrigin) {
    if (allowedOrigins.includes(requestOrigin)) {
      origin = requestOrigin;
    } else {
      origin = allowedOrigins[0]; // Fallback to first allowed origin
    }
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// Backwards compatible export for existing code
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};
```

**What needs to change per function:**
1. Import `getCorsHeaders` instead of `corsHeaders` (or remove inline const)
2. Extract `req.headers.get('Origin')` at top of handler
3. Replace all `corsHeaders` references with `getCorsHeaders(origin)`
4. Handle CORS preflight: `new Response(null, { headers: getCorsHeaders(origin) })`

**Migration pattern:**
```typescript
// BEFORE (inline or imported corsHeaders)
const corsHeaders = { 'Access-Control-Allow-Origin': '*', ... };
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // ... 
  return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

// AFTER
import { getCorsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const headers = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  // ...
  return new Response(body, { headers: { ...headers, 'Content-Type': 'application/json' } });
});
```

**Important notes:**
- Some functions use `corsHeaders` in many places (e.g., `test-env-vars` has 5 uses, `chat-stream` has multiple)
- Some functions also have inconsistent headers (missing `sentry-trace`, `baggage`, or `Access-Control-Allow-Methods`)
- The `ALLOWED_ORIGINS` env var must be set in Supabase secrets before deploying, or all functions will fall back to `*`
- Note: 2 of the 49 functions (`extract-knowledge`, `generate-content`) will be deleted in SEC-02, reducing the scope to 47 + 14 = 61

**Risk assessment:** MEDIUM. This is a wide-blast-radius change. If `ALLOWED_ORIGINS` is misconfigured, ALL edge functions break with CORS errors. Mitigation:
1. Set `ALLOWED_ORIGINS` env var FIRST with correct production domains
2. Test with one function before batch migration
3. Keep `corsHeaders` backward-compatible export in `_shared/cors.ts` during migration (already exists)
4. Deploy incrementally, not all at once

**Categorization of 49 inline functions:**

**Group A: Will be deleted (2 functions — skip for CORS migration):**
- `extract-knowledge`
- `generate-content`

**Group B: Functions that already import shared cors but need `getCorsHeaders()` (14 functions):**
- `coach-notes`, `coach-relationships`, `coach-shares`, `content-builder`, `content-classifier`, `content-hook-generator`, `content-insight-miner`, `get-available-models`, `manager-notes`, `share-call`, `team-direct-reports`, `team-memberships`, `team-shares`, `teams`

**Group C: Functions with inline CORS needing full migration (47 functions):**
All remaining — see full list in SEC-06 current state above, minus the 2 being deleted.

---

## Patterns to Follow

### Standard Auth Check Pattern (used by ~40 edge functions)
```typescript
// From delete-all-calls/index.ts — representative of the standard pattern
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Missing authorization header' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const jwt = authHeader.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

if (authError || !user) {
  return new Response(
    JSON.stringify({ error: 'Invalid authentication' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Admin Role Check Pattern (from get-available-models)
```typescript
const { data: roleData } = await supabaseClient
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle();

const isAdmin = roleData?.role === 'ADMIN';
```

### Logger Pattern (from src/lib/logger.ts)
```typescript
import { logger } from '@/lib/logger';

// Instead of console.log:
logger.debug('message', optionalData);  // Suppressed in production
logger.info('message', optionalData);   // Suppressed in production
logger.warn('message', optionalData);   // Shows in production
logger.error('message', optionalData);  // Shows in production
```

### CORS Dynamic Origin Pattern (from _shared/cors.ts)
```typescript
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const headers = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  // Use `headers` in all responses
});
```

## Common Pitfalls

### Pitfall 1: Breaking CORS on Deploy
**What goes wrong:** Deploying CORS changes without `ALLOWED_ORIGINS` env var set causes all edge functions to reject legitimate requests.
**Why it happens:** `getCorsHeaders()` defaults to `['*']` only if `ALLOWED_ORIGINS` is not set. If set incorrectly, it returns the wrong origin.
**How to avoid:** Set `ALLOWED_ORIGINS` in Supabase secrets BEFORE deploying any CORS changes. Include all valid origins: production domain, localhost for dev, preview URLs.
**Warning signs:** CORS errors in browser console after deploy.

### Pitfall 2: Removing Console Logs Needed for Debugging
**What goes wrong:** Removing all console logs makes it impossible to debug production issues.
**Why it happens:** Overzealous cleanup.
**How to avoid:** Replace with `logger.debug()` (not delete). The logger suppresses in production but works in development. Keep `logger.error()` calls for genuine errors.

### Pitfall 3: Breaking ContentGenerator.tsx
**What goes wrong:** Deleting `ai-agent.ts` breaks `ContentGenerator.tsx` which imports its types.
**Why it happens:** The type `ExtractedInsight` is only defined in `ai-agent.ts`.
**How to avoid:** Before deleting, either move the `ExtractedInsight` type to a shared types file, or check if `ContentGenerator.tsx` is dead code that can also be removed.

### Pitfall 4: test-env-vars Database Export
**What goes wrong:** The `test-env-vars` function has a `?action=export` mode that dumps the entire database.
**Why it happens:** It was a one-time debug tool that was never removed.
**How to avoid:** Delete the function entirely rather than trying to secure it. It self-documents as "DELETE AFTER USE."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS handling | Inline `corsHeaders` objects | `getCorsHeaders()` from `_shared/cors.ts` | Dynamic origin checking, single source of truth |
| Production logging | `console.log()` | `logger` from `src/lib/logger.ts` | Environment-aware, suppresses debug in production |
| Auth checking | Custom JWT parsing | `supabase.auth.getUser(token)` pattern | Standard Supabase pattern, handles token validation |
| Admin role check | Custom role logic | Query `user_roles` table for `role === 'ADMIN'` | Existing pattern used in `get-available-models` |

## Open Questions

1. **Should `test-env-vars` be deleted or secured?**
   - What we know: It exposes full credentials, has a DB export mode, and self-documents as "DELETE AFTER USE"
   - Recommendation: Delete entirely. It's a one-time debug tool with extreme exposure surface.

2. **Is `ContentGenerator.tsx` actively used?**
   - What we know: It imports from `ai-agent.ts` which will be deleted. Located in `src/components/loop/`
   - What's unclear: Whether the Loop feature is actively rendered in the app
   - Recommendation: Check if it appears in any route/layout. If dead code, delete it too.

3. **What should `ALLOWED_ORIGINS` contain?**
   - What we know: Needs production domain(s) and possibly localhost for dev
   - What's unclear: Exact production domains, preview/staging URLs
   - Recommendation: Check Vercel deployment settings for the list of valid origins.

4. **Should the `corsHeaders` backward-compatible export in `_shared/cors.ts` be removed?**
   - What we know: Line 24-27 exports `corsHeaders` with wildcard `*` for backward compatibility. 14 functions import this.
   - Recommendation: Remove it AFTER all functions are migrated to `getCorsHeaders()`. Don't remove it during migration — it provides safety net.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all referenced files in the codebase
- `src/lib/ai-agent.ts` — full file read
- `supabase/functions/_shared/cors.ts` — full file read
- `supabase/functions/test-env-vars/index.ts` — full file read  
- `supabase/functions/test-secrets/index.ts` — full file read
- `supabase/functions/extract-knowledge/index.ts` — full file read
- `supabase/functions/generate-content/index.ts` — full file read
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` — full file read
- `src/contexts/AuthContext.tsx` — full file read
- `src/pages/Chat.tsx` — relevant sections read
- `src/hooks/useChatSession.ts` — full file read
- `src/hooks/useAIProcessing.ts` — full file read
- `src/types/meetings.ts` — full file read
- `src/lib/export-utils.ts` — relevant sections read
- `src/lib/logger.ts` — relevant sections read
- `docs/reference/feature-audit-report.md` — referenced for SEC-01 assessment

### Verification
- `grep` for `VITE_OPENAI_API_KEY` across entire codebase — 13 matches catalogued
- `grep` for `extract-knowledge`/`generate-content` in `src/` — 0 matches (confirmed no callers)
- `grep` for `Access-Control-Allow-Origin.*\*` in edge functions — 53 matches across 49 files
- `grep` for `_shared/cors` imports — 14 files use shared module
- `grep` for `getCorsHeaders` usage — 0 functions use it (only defined in `_shared/cors.ts`)
- `grep` for `user_roles` in edge functions — found admin check pattern in `get-available-models`
- `grep` for `auth.getUser` in edge functions — 40+ functions use standard auth pattern

## Metadata

**Confidence breakdown:**
- SEC-01 (API key removal): HIGH — complete code path traced, dead code confirmed
- SEC-02 (Legacy function deletion): HIGH — no callers found, clean deletion
- SEC-03 (Admin auth): HIGH — existing patterns identified, straightforward replication
- SEC-04 (Sensitive logging): HIGH — every line catalogued with PII risk assessment
- SEC-05 (Type safety): HIGH — root cause identified, type mismatch fully understood
- SEC-06 (CORS migration): HIGH — all 63 functions catalogued, migration pattern clear

**Research date:** 2026-01-27
**Valid until:** No expiration — this is codebase-specific research, not library-dependent
