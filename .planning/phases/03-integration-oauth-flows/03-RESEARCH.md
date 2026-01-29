# Phase 3: Integration OAuth Flows - Research

**Researched:** 2026-01-28
**Domain:** OAuth 2.0 integration fixes (Zoom and Google Meet)
**Confidence:** HIGH

## Summary

This phase focuses on **fixing existing OAuth implementations** rather than building new ones. The codebase already has complete OAuth flows for Zoom and Google Meet with proper architecture, but critical bugs prevent them from working:

1. **Zoom OAuth callback has a redirect URI mismatch** - The `zoom-oauth-url` function uses `https://app.callvaultai.com/oauth/callback/zoom` but `zoom-oauth-callback` uses `https://app.callvaultai.com/oauth/callback/` (missing "zoom", has trailing slash). This causes Zoom's token exchange to fail with "redirect_uri_mismatch".

2. **Google OAuth appears functional** - The implementation follows correct patterns with matching redirect URIs, proper token storage, and error handling. The "infinite spinner" issue was previously addressed with proper timeout handling in `InlineConnectionWizard.tsx`.

The existing architecture is sound: Edge Functions handle OAuth server-side, frontend uses redirect-based flow with state management, and tokens are securely stored in `user_settings` table with CSRF protection via state parameter.

**Primary recommendation:** Fix the Zoom redirect URI mismatch in `zoom-oauth-callback/index.ts` (line 63) to use `https://app.callvaultai.com/oauth/callback/zoom` to match the URL function. Verify both flows end-to-end.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Edge Functions | latest | OAuth server-side logic | Already in use, handles secrets securely |
| Supabase JS Client | 2.x | Database operations | Consistent with existing codebase |
| React Router | 6.x | OAuth callback routing | Already configured with routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ZoomClient (custom) | - | Zoom API wrapper with retry | Already exists in `_shared/zoom-client.ts` |
| GoogleClient (custom) | - | Google API wrapper with retry | Already exists in `_shared/google-client.ts` |
| sonner (toast) | - | Error/success notifications | Already used for user feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom OAuth clients | NextAuth/Auth.js | Would require significant refactor, current solution works |
| Edge Functions | External auth service | More complexity, current approach is sufficient |

**Installation:** None needed - all dependencies already installed.

## Architecture Patterns

### Existing OAuth Flow Architecture
```
┌──────────────────────────────────────────────────────────────────┐
│ Frontend (React)                                                  │
│                                                                   │
│  1. User clicks "Connect Zoom/Google"                            │
│  2. InlineConnectionWizard calls getZoomOAuthUrl()/getGoogleOAuthUrl() │
│  3. Frontend stores pendingOAuthPlatform in sessionStorage       │
│  4. window.location.href = authUrl (redirect to provider)        │
│                                                                   │
│  POST-OAUTH:                                                     │
│  5. Provider redirects to /oauth/callback/zoom or /oauth/callback/meet │
│  6. OAuthCallback.tsx extracts code + state from URL             │
│  7. Calls completeZoomOAuth()/completeGoogleOAuth()              │
│  8. Shows success/error, redirects to /settings?tab=integrations │
└───────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Backend (Supabase Edge Functions)                                 │
│                                                                   │
│  *-oauth-url:                                                    │
│  1. Authenticate user from JWT                                   │
│  2. Generate CSRF state, store in user_settings                  │
│  3. Build authorization URL with redirect_uri                    │
│  4. Return authUrl to frontend                                   │
│                                                                   │
│  *-oauth-callback:                                               │
│  1. Authenticate user from JWT                                   │
│  2. Extract code + state from request body                       │
│  3. Verify state matches stored value (CSRF protection)          │
│  4. Exchange code for tokens via provider's token endpoint       │
│  5. Store access_token, refresh_token, expires_at                │
│  6. Clear state, return success                                  │
└───────────────────────────────────────────────────────────────────┘
```

### File Structure (Existing)
```
supabase/functions/
├── _shared/
│   ├── cors.ts              # Dynamic CORS with getCorsHeaders()
│   ├── zoom-client.ts       # Zoom API client with retry
│   └── google-client.ts     # Google API client with retry
├── zoom-oauth-url/          # Generate Zoom auth URL
├── zoom-oauth-callback/     # Exchange Zoom code for tokens ← BUG HERE
├── zoom-oauth-refresh/      # Refresh Zoom access token
├── google-oauth-url/        # Generate Google auth URL
├── google-oauth-callback/   # Exchange Google code for tokens
└── google-oauth-refresh/    # Refresh Google access token

src/
├── lib/
│   ├── api-client.ts        # getZoomOAuthUrl, getGoogleOAuthUrl, completeXxxOAuth
│   └── zoom-api-client.ts   # Additional Zoom meeting functions
├── components/sync/
│   └── InlineConnectionWizard.tsx  # Connect button with timeout handling
└── pages/
    └── OAuthCallback.tsx    # Handle provider redirects
```

### Pattern: Redirect URI Consistency
**What:** All redirect URIs must match EXACTLY across:
1. OAuth provider app configuration (Zoom Marketplace / Google Cloud Console)
2. URL generation function (`*-oauth-url`)
3. Token exchange function (`*-oauth-callback`)

**When to use:** Always - OAuth 2.0 spec requires exact match

**Example (CORRECT):**
```typescript
// In zoom-oauth-url/index.ts
const redirectUri = 'https://app.callvaultai.com/oauth/callback/zoom';

// In zoom-oauth-callback/index.ts - MUST MATCH EXACTLY
const redirectUri = 'https://app.callvaultai.com/oauth/callback/zoom';
```

### Anti-Patterns to Avoid
- **Inconsistent redirect URIs:** Causes immediate OAuth failure (current Zoom bug)
- **Hardcoded trailing slashes:** Some providers are sensitive to trailing slash presence
- **Missing state verification:** Opens CSRF vulnerabilities
- **Storing tokens client-side:** Security risk - always use server-side storage

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token refresh logic | Custom refresh scheduler | Existing `*-oauth-refresh` functions | Already handles expiration checking |
| CSRF protection | Custom token generation | `crypto.randomUUID()` + database state | Pattern already established |
| API retry logic | Simple fetch | `ZoomClient`/`GoogleClient` wrappers | Handles rate limits, exponential backoff |
| Error display | Custom error UI | `toast.error()` + `InlineConnectionWizard` error states | UX already designed |

**Key insight:** The OAuth infrastructure exists and is well-designed. The bugs are simple configuration mismatches, not architectural flaws.

## Common Pitfalls

### Pitfall 1: Redirect URI Mismatch
**What goes wrong:** Token exchange fails with "redirect_uri_mismatch" or similar
**Why it happens:** URIs don't match character-for-character across all locations
**How to avoid:** 
- Define redirect URI as constant in one place
- Check trailing slashes, scheme (http vs https), path segments
**Warning signs:** "non-200 error" on callback, "invalid_grant" errors

### Pitfall 2: State Parameter Timing
**What goes wrong:** State validation fails intermittently
**Why it happens:** User takes too long, or state cleared prematurely
**How to avoid:**
- Don't set state expiration too short
- Clear state ONLY after successful token exchange
**Warning signs:** "Invalid state parameter" errors for legitimate users

### Pitfall 3: Token Storage Race Conditions
**What goes wrong:** Tokens not available immediately after OAuth success
**Why it happens:** Database write not complete before frontend reads
**How to avoid:** 
- Return success ONLY after database write confirms
- Frontend should handle brief loading state
**Warning signs:** "Not connected" shown immediately after "Connected successfully"

### Pitfall 4: Google Refresh Token Not Returned
**What goes wrong:** No refresh token in token response
**Why it happens:** Google only returns refresh_token on first authorization, OR missing `prompt=consent` + `access_type=offline`
**How to avoid:**
- Always use `access_type=offline` and `prompt=consent` for initial auth
- Store refresh token immediately - it won't come again
**Warning signs:** Connection works initially but fails after access token expires

### Pitfall 5: Provider-Specific Error Formats
**What goes wrong:** Generic error messages hide real issue
**Why it happens:** Zoom and Google have different error response formats
**How to avoid:**
- Log full error response before parsing
- Handle both JSON and text error responses
**Warning signs:** "Unknown error" when provider gave specific reason

## Code Examples

### Critical Fix: Zoom Redirect URI
```typescript
// File: supabase/functions/zoom-oauth-callback/index.ts
// Line 63 - CURRENT (BROKEN):
const redirectUri = 'https://app.callvaultai.com/oauth/callback/';

// Should be (FIXED):
const redirectUri = 'https://app.callvaultai.com/oauth/callback/zoom';
```

### Verified Pattern: Google OAuth URL Generation
```typescript
// Source: supabase/functions/google-oauth-url/index.ts
// This is CORRECT - reference implementation
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', 'https://app.callvaultai.com/oauth/callback/meet');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');  // Forces refresh token
authUrl.searchParams.set('state', state);
```

### Verified Pattern: CSRF State Handling
```typescript
// Source: Both zoom and google oauth functions
// Generate state
const state = crypto.randomUUID();

// Store state in database
await supabase
  .from('user_settings')
  .upsert({
    user_id: user.id,
    zoom_oauth_state: state,  // or google_oauth_state
  }, { onConflict: 'user_id' });

// In callback: Verify state
const { data: settings } = await supabase
  .from('user_settings')
  .select('zoom_oauth_state')
  .eq('user_id', user.id)
  .maybeSingle();

if (!settings || settings.zoom_oauth_state !== state) {
  return new Response(
    JSON.stringify({ error: 'Invalid state parameter' }),
    { status: 400, ... }
  );
}
```

### Verified Pattern: Frontend Error Handling
```typescript
// Source: src/components/sync/InlineConnectionWizard.tsx
// 30-second timeout with user-friendly messaging
const CONNECTION_TIMEOUT_MS = 30000;

timeoutRef.current = setTimeout(() => {
  logger.warn(`OAuth connection timeout for ${platform}`);
  setConnectionState({ status: "timeout" });
  toast.error(`Connection timed out. Please try again.`);
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
}, CONNECTION_TIMEOUT_MS);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Popup OAuth flow | Full-page redirect | Already current | More reliable, no popup blockers |
| Client-side token storage | Server-side (database) | Already current | More secure |
| Manual token refresh | On-demand via *-oauth-refresh | Already current | Better UX |

**Deprecated/outdated:**
- Implicit OAuth flow (returns token in URL fragment): Security risk, use authorization code flow instead

## Open Questions

Things that couldn't be fully resolved:

1. **Google Meet "beta" labeling**
   - What we know: User requested Google Meet be marked as experimental due to limited testability
   - What's unclear: Exact UI treatment (badge, tooltip, separate section?)
   - Recommendation: Add "(Beta)" text next to Google Meet name, add tooltip explaining requires paid workspace

2. **Zoom app configuration verification**
   - What we know: Redirect URI in code must match Zoom Marketplace app settings
   - What's unclear: Whether `https://app.callvaultai.com/oauth/callback/zoom` is registered in Zoom app
   - Recommendation: Verify Zoom Marketplace app has correct redirect URI configured

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `supabase/functions/zoom-oauth-url/index.ts` (line 39)
- Codebase analysis: `supabase/functions/zoom-oauth-callback/index.ts` (line 63)
- Codebase analysis: `supabase/functions/google-oauth-url/index.ts`
- Codebase analysis: `supabase/functions/google-oauth-callback/index.ts`
- Codebase analysis: `src/pages/OAuthCallback.tsx`
- Codebase analysis: `src/components/sync/InlineConnectionWizard.tsx`
- Google OAuth official docs: https://developers.google.com/identity/protocols/oauth2/web-server

### Secondary (MEDIUM confidence)
- User context from CONTEXT.md describing "non-200 error" symptom
- Existing specs (spec-015, spec-018, spec-045) describing symptoms

### Tertiary (LOW confidence)
- Zoom OAuth documentation (site had limited content available)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from existing codebase
- Architecture: HIGH - patterns extracted from working Google implementation
- Pitfalls: HIGH - derived from code analysis and OAuth standards
- Bug identification: HIGH - direct comparison of redirect URIs shows mismatch

**Research date:** 2026-01-28
**Valid until:** No expiration - OAuth 2.0 spec is stable, findings are code-specific

## Implementation Notes for Planner

### Must Fix (Zoom OAuth)
1. **Line 63 in `zoom-oauth-callback/index.ts`:** Change `'https://app.callvaultai.com/oauth/callback/'` to `'https://app.callvaultai.com/oauth/callback/zoom'`
2. Verify Zoom Marketplace app has `https://app.callvaultai.com/oauth/callback/zoom` in allowed redirect URIs

### Should Verify (Google OAuth)
1. End-to-end test of Google OAuth flow
2. Confirm refresh token is being stored
3. Test timeout behavior

### Nice to Have
1. Add "(Beta)" label to Google Meet integration
2. Improve error messages with error codes as specified in CONTEXT.md
3. Add disconnection confirmation dialog with call count
