---
name: zoom-integration-ui-wiring.md
description: "Wire up existing Zoom integration backend to frontend UI"
---

## Goal

**Feature Goal**: Activate the existing Zoom integration by wiring the complete backend infrastructure to the frontend UI, allowing users to connect their Zoom accounts via OAuth and sync cloud recordings.

**Deliverable**: Fully functional Zoom integration in the Settings > Integrations page with OAuth flow, status display, and Source Priority Modal integration.

**Success Definition**:
1. Zoom card shows "Connect" button instead of "Coming Soon"
2. Clicking "Connect" opens ZoomSetupWizard
3. OAuth flow redirects to Zoom, completes authorization, and returns to settings
4. Integration status shows "Connected" after successful OAuth
5. Source Priority Modal includes Zoom when multiple integrations are connected

## User Persona (if applicable)

**Target User**: CallVault users with Zoom Pro/Business accounts who want to sync their cloud recordings.

**Use Case**: Sales rep or coach wants to import Zoom meeting transcripts for AI analysis alongside existing Fathom/Google Meet recordings.

**User Journey**:
1. Navigate to Settings > Integrations
2. See Zoom card with "Connect" button
3. Click Connect → ZoomSetupWizard opens
4. Review requirements → Click "Connect with Zoom"
5. Redirect to Zoom OAuth consent screen
6. Authorize CallVault access
7. Redirect back to `/oauth/callback/zoom`
8. See success message → Redirect to Integrations
9. Zoom card now shows "Connected" status

**Pain Points Addressed**: Users currently cannot connect Zoom despite backend being ready, limiting integration options.

## Why

- **Complete feature parity**: Zoom is a major meeting platform alongside Fathom and Google Meet
- **Backend already done**: All Edge Functions, database schema, and API client code exist - just needs UI wiring
- **Minimal effort, high impact**: ~100 lines of changes across 4 files to unlock entire Zoom integration
- **User demand**: Zoom is the most requested integration after existing options

## What

Activate Zoom integration by:
1. Adding Zoom state management to IntegrationsTab
2. Wiring ZoomSetupWizard modal
3. Adding Zoom OAuth callback route
4. Updating OAuthCallback to handle Zoom
5. Integrating with Source Priority Modal

### Success Criteria

- [ ] Zoom card displays "disconnected" status (not "coming-soon")
- [ ] ZoomSetupWizard opens when clicking Connect
- [ ] OAuth flow completes successfully with token storage
- [ ] Integration status updates to "connected" after OAuth
- [ ] Source Priority Modal includes Zoom in platform list
- [ ] Existing Fathom/Google Meet integrations continue working

## All Needed Context

### Context Completeness Check

_This PRP provides everything needed for implementation: exact file paths, line numbers, code patterns, and complete code snippets. An implementing agent can follow these instructions without additional research._

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: src/components/settings/IntegrationsTab.tsx
  why: Primary file to modify - contains all integration state, handlers, and UI
  pattern: Follow exact structure of Google Meet integration (state vars, handlers, card, wizard)
  gotcha: Must include Zoom in connectedPlatforms array for SourcePriorityModal

- file: src/pages/OAuthCallback.tsx
  why: Add Zoom detection and callback handling
  pattern: Follow isGoogleCallback pattern for isZoomCallback
  gotcha: Import completeZoomOAuth from zoom-api-client.ts, not api-client.ts

- file: src/App.tsx
  why: Add /oauth/callback/zoom route
  pattern: Follow /oauth/callback/google route pattern exactly
  gotcha: Route must be BEFORE the catch-all route

- file: src/components/settings/ZoomSetupWizard.tsx
  why: Already complete - just needs to be imported and used
  pattern: Same props interface as GoogleMeetSetupWizard
  gotcha: Component uses callEdgeFunction directly (not zoom-api-client)

- file: src/lib/zoom-api-client.ts
  why: Contains completeZoomOAuth function needed for callback
  pattern: Already exports all Zoom functions with proper typing
  gotcha: Import from this file, NOT api-client.ts

- url: https://developers.zoom.us/docs/integrations/oauth/
  why: Reference for OAuth flow understanding
  critical: Access tokens expire in 1 hour, always use latest refresh token

- url: https://developers.zoom.us/docs/integrations/oauth-scopes/
  why: Understanding what scopes are requested
  critical: recording:read:admin scope provides access to cloud recordings
```

### Current Codebase tree (relevant files only)

```bash
src/
├── App.tsx                                    # ADD: /oauth/callback/zoom route
├── pages/
│   └── OAuthCallback.tsx                      # MODIFY: Add Zoom callback handling
├── components/
│   └── settings/
│       ├── IntegrationsTab.tsx                # MODIFY: Primary changes here
│       ├── ZoomSetupWizard.tsx                # EXISTS: Just import and use
│       ├── GoogleMeetSetupWizard.tsx          # REFERENCE: Pattern to follow
│       ├── FathomSetupWizard.tsx              # REFERENCE: Pattern to follow
│       ├── IntegrationStatusCard.tsx          # EXISTS: No changes needed
│       └── SourcePriorityModal.tsx            # EXISTS: Just pass Zoom in array
└── lib/
    ├── api-client.ts                          # REFERENCE: Pattern for Edge Function calls
    └── zoom-api-client.ts                     # EXISTS: Use completeZoomOAuth from here
```

### Desired Codebase tree with files to be added and responsibility of file

```bash
# No new files needed - all infrastructure exists
# Only modifications to existing files:

src/App.tsx
  └── ADD: Route for /oauth/callback/zoom

src/pages/OAuthCallback.tsx
  └── ADD: Zoom detection and callback handling

src/components/settings/IntegrationsTab.tsx
  └── ADD: Zoom state, handlers, card status change, wizard modal
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: zoom-api-client.ts exists separately from api-client.ts
// The completeZoomOAuth function is in zoom-api-client.ts
// Do NOT try to add it to api-client.ts - import from zoom-api-client.ts

// CRITICAL: ZoomSetupWizard uses callEdgeFunction directly
// This is fine - don't change it to use zoom-api-client functions

// CRITICAL: SourcePriorityModal expects platform strings
// Must pass "zoom" (lowercase) in connectedPlatforms array

// CRITICAL: Database column is zoom_oauth_access_token
// Use this to check connection status in loadIntegrationStatus
```

## Implementation Blueprint

### Data models and structure

No new data models needed - all types exist in:
- `src/lib/zoom-api-client.ts` - Zoom OAuth response types
- `src/integrations/supabase/types.ts` - Database types include zoom_oauth_* columns

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: ADD Zoom OAuth route to App.tsx
  - LOCATE: Line 62 (after /oauth/callback/google route)
  - ADD: Route for /oauth/callback/zoom using same pattern
  - PATTERN: Copy line 62, change "google" to "zoom"
  - PLACEMENT: Before catch-all route (line 104)
  - VALIDATION: Route appears in React DevTools router

Task 2: UPDATE OAuthCallback.tsx to handle Zoom
  - IMPORT: Add completeZoomOAuth from "@/lib/zoom-api-client" (line 6)
  - LOCATE: Provider detection logic (lines 50-51)
  - ADD: isZoomCallback detection using pathname.includes("/zoom")
  - ADD: Provider ternary for Zoom case
  - LOCATE: Callback dispatch logic (lines 57-62)
  - ADD: else if branch for Zoom calling completeZoomOAuth
  - VALIDATION: Console logs show "Processing Zoom OAuth callback"

Task 3: UPDATE IntegrationsTab.tsx - State Variables
  - IMPORT: Add ZoomSetupWizard from "./ZoomSetupWizard" (after line 10)
  - LOCATE: State declarations section (lines 19-38)
  - ADD: zoomConnected state (useState(false))
  - ADD: showZoomWizard state (useState(false))
  - PATTERN: Follow exact pattern of googleMeetConnected/showGoogleMeetWizard
  - PLACEMENT: After Google Meet state (after line 26)

Task 4: UPDATE IntegrationsTab.tsx - Load Status
  - LOCATE: loadIntegrationStatus function (lines 44-94)
  - MODIFY: Add zoom_oauth_access_token to select query (line 51)
  - ADD: isZoomConnected check after isGoogleConnected (line 57)
  - ADD: setZoomConnected(isZoomConnected) call
  - PATTERN: Follow exact pattern of Google Meet status check
  - VALIDATION: Console logs show correct Zoom connection status

Task 5: UPDATE IntegrationsTab.tsx - Handlers
  - LOCATE: Handler functions section (lines 96-120)
  - ADD: handleZoomConnect function (sets showZoomWizard to true)
  - ADD: handleZoomWizardComplete function
    - Sets showZoomWizard to false
    - Calls loadIntegrationStatus()
    - Shows SourcePriorityModal if fathomConnected || googleMeetConnected
  - PATTERN: Follow exact pattern of handleGoogleMeetConnect/handleGoogleMeetWizardComplete
  - PLACEMENT: After handleGoogleMeetWizardComplete (after line 120)

Task 6: UPDATE IntegrationsTab.tsx - Card UI
  - LOCATE: Zoom IntegrationStatusCard (lines 376-381)
  - CHANGE: status from "coming-soon" to {zoomConnected ? "connected" : "disconnected"}
  - ADD: onConnect={handleZoomConnect} prop
  - ADD: Dynamic description based on connection status
  - PATTERN: Follow exact pattern of Google Meet card (lines 350-359)

Task 7: UPDATE IntegrationsTab.tsx - Wizard Modal
  - LOCATE: Modals section (lines 391-418)
  - ADD: ZoomSetupWizard conditional render after GoogleMeetSetupWizard
  - PROPS: open={showZoomWizard}, onComplete={handleZoomWizardComplete}, onDismiss={() => setShowZoomWizard(false)}
  - PATTERN: Follow exact pattern of GoogleMeetSetupWizard (lines 400-406)
  - PLACEMENT: Before SourcePriorityModal

Task 8: UPDATE IntegrationsTab.tsx - Source Priority Modal
  - LOCATE: SourcePriorityModal connectedPlatforms prop (lines 413-416)
  - ADD: ...(zoomConnected ? ["zoom"] : []) to array
  - PATTERN: Follow pattern of fathom and google_meet entries
  - PLACEMENT: After google_meet entry

Task 9: VERIFY Complete Integration
  - TEST: Manual OAuth flow through Zoom
  - VERIFY: Token stored in user_settings.zoom_oauth_access_token
  - VERIFY: Card shows "Connected" status
  - VERIFY: Source Priority Modal appears with Zoom option
  - VERIFY: Existing Fathom/Google integrations still work
```

### Implementation Patterns & Key Details

```typescript
// ===== App.tsx - Add Route (Task 1) =====
// AFTER line 62, ADD:
<Route path="/oauth/callback/zoom" element={<ProtectedRoute><OAuthCallback /></ProtectedRoute>} />


// ===== OAuthCallback.tsx - Import (Task 2) =====
// CHANGE line 6 FROM:
import { completeFathomOAuth, completeGoogleOAuth } from "@/lib/api-client";
// TO:
import { completeFathomOAuth, completeGoogleOAuth } from "@/lib/api-client";
import { completeZoomOAuth } from "@/lib/zoom-api-client";


// ===== OAuthCallback.tsx - Provider Detection (Task 2) =====
// REPLACE lines 50-51:
const isGoogleCallback = location.pathname.includes("/google");
const provider = isGoogleCallback ? "Google Meet" : "Fathom";

// WITH:
const isGoogleCallback = location.pathname.includes("/google");
const isZoomCallback = location.pathname.includes("/zoom");
const provider = isGoogleCallback ? "Google Meet" : isZoomCallback ? "Zoom" : "Fathom";


// ===== OAuthCallback.tsx - Callback Dispatch (Task 2) =====
// REPLACE lines 57-62:
let response;
if (isGoogleCallback) {
  response = await completeGoogleOAuth(code, stateParam);
} else {
  response = await completeFathomOAuth(code, stateParam);
}

// WITH:
let response;
if (isGoogleCallback) {
  response = await completeGoogleOAuth(code, stateParam);
} else if (isZoomCallback) {
  response = await completeZoomOAuth(code, stateParam);
} else {
  response = await completeFathomOAuth(code, stateParam);
}


// ===== IntegrationsTab.tsx - Import (Task 3) =====
// ADD after line 10:
import ZoomSetupWizard from "./ZoomSetupWizard";


// ===== IntegrationsTab.tsx - State (Task 3) =====
// ADD after line 26 (after googleEmail state):
// Zoom state
const [zoomConnected, setZoomConnected] = useState(false);
const [showZoomWizard, setShowZoomWizard] = useState(false);


// ===== IntegrationsTab.tsx - Load Status (Task 4) =====
// MODIFY line 51 - add zoom_oauth_access_token to select:
.select("fathom_api_key, webhook_secret, oauth_access_token, google_oauth_access_token, google_oauth_email, zoom_oauth_access_token, dedup_platform_order")

// ADD after line 70 (after Google email check):
// Check Zoom connection status
const isZoomConnected = !!settings?.zoom_oauth_access_token;
setZoomConnected(isZoomConnected);


// ===== IntegrationsTab.tsx - Handlers (Task 5) =====
// ADD after line 120 (after handleGoogleMeetWizardComplete):
const handleZoomConnect = () => {
  setShowZoomWizard(true);
};

const handleZoomWizardComplete = async () => {
  setShowZoomWizard(false);
  await loadIntegrationStatus();
  // Show SourcePriorityModal if another integration is already connected
  if (fathomConnected || googleMeetConnected) {
    setShowSourcePriorityModal(true);
  }
};


// ===== IntegrationsTab.tsx - Card UI (Task 6) =====
// REPLACE lines 376-381:
<IntegrationStatusCard
  name="Zoom"
  icon={RiVideoLine}
  status="coming-soon"
  description="Direct Zoom meeting integration"
/>

// WITH:
<IntegrationStatusCard
  name="Zoom"
  icon={RiVideoLine}
  status={zoomConnected ? "connected" : "disconnected"}
  onConnect={handleZoomConnect}
  description={zoomConnected ? "Cloud recordings synced" : "Direct Zoom meeting integration"}
/>


// ===== IntegrationsTab.tsx - Wizard Modal (Task 7) =====
// ADD after line 406 (after GoogleMeetSetupWizard closing brace):
{showZoomWizard && (
  <ZoomSetupWizard
    open={showZoomWizard}
    onComplete={handleZoomWizardComplete}
    onDismiss={() => setShowZoomWizard(false)}
  />
)}


// ===== IntegrationsTab.tsx - Source Priority Modal (Task 8) =====
// REPLACE lines 413-416:
connectedPlatforms={[
  ...(fathomConnected ? ["fathom"] : []),
  ...(googleMeetConnected ? ["google_meet"] : []),
]}

// WITH:
connectedPlatforms={[
  ...(fathomConnected ? ["fathom"] : []),
  ...(googleMeetConnected ? ["google_meet"] : []),
  ...(zoomConnected ? ["zoom"] : []),
]}
```

### Integration Points

```yaml
DATABASE:
  - No changes needed - zoom_oauth_* columns already exist
  - Migration: 20260110000011_add_zoom_oauth_columns.sql (already applied)

CONFIG:
  - No changes needed - ZOOM_OAUTH_CLIENT_ID and ZOOM_OAUTH_CLIENT_SECRET already in env

ROUTES:
  - ADD: /oauth/callback/zoom in src/App.tsx
  - PATTERN: Copy exact structure of /oauth/callback/google

EDGE FUNCTIONS:
  - No changes needed - all 5 Zoom functions already exist and deployed:
    - zoom-oauth-url
    - zoom-oauth-callback
    - zoom-oauth-refresh
    - zoom-fetch-meetings
    - zoom-sync-meetings
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file modification
npm run type-check       # TypeScript validation
npm run lint             # ESLint validation

# Expected: Zero errors
# Common issues:
# - Missing import for ZoomSetupWizard
# - Missing import for completeZoomOAuth
# - Typos in state variable names
```

### Level 2: Unit Tests (Component Validation)

```bash
# No new tests needed for this UI wiring
# Existing tests should continue passing
npm run test

# Expected: All existing tests pass
```

### Level 3: Integration Testing (System Validation)

```bash
# Start dev server
npm run dev

# Manual test flow:
# 1. Navigate to http://localhost:8080/settings?tab=integrations
# 2. Verify Zoom card shows "Not Connected" (not "Coming Soon")
# 3. Click "Connect" button
# 4. Verify ZoomSetupWizard modal opens
# 5. Click "Next" to OAuth step
# 6. Click "Connect with Zoom"
# 7. Should redirect to Zoom OAuth consent
# 8. After authorization, redirects to /oauth/callback/zoom
# 9. Should show success message
# 10. Redirects to /settings?tab=integrations
# 11. Zoom card should now show "Connected"

# Verify database:
# In Supabase dashboard, check user_settings table
# zoom_oauth_access_token should be populated
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Visual verification using Playwright MCP
# Navigate to integrations page
# Take screenshot of Zoom card in disconnected state
# Complete OAuth flow
# Take screenshot of Zoom card in connected state

# Test Source Priority Modal:
# 1. Connect Fathom first (if not already)
# 2. Connect Zoom
# 3. Source Priority Modal should appear with both platforms
# 4. Verify "zoom" appears as an option

# Verify existing integrations unaffected:
# 1. If Fathom connected, verify still shows connected
# 2. If Google Meet connected, verify still shows connected
# 3. Test Fathom OAuth reconnect flow still works
# 4. Test Google Meet OAuth reconnect flow still works
```

## Final Validation Checklist

### Technical Validation

- [ ] TypeScript compilation succeeds: `npm run type-check`
- [ ] ESLint passes: `npm run lint`
- [ ] Dev server starts without errors: `npm run dev`
- [ ] No console errors on integrations page load

### Feature Validation

- [ ] Zoom card displays "Not Connected" status (not "Coming Soon")
- [ ] Connect button is visible and clickable
- [ ] ZoomSetupWizard opens correctly
- [ ] OAuth redirect to Zoom works
- [ ] OAuth callback handled at /oauth/callback/zoom
- [ ] Success toast appears after OAuth
- [ ] Redirects to integrations page after OAuth
- [ ] Zoom card shows "Connected" after successful OAuth
- [ ] Source Priority Modal includes Zoom option
- [ ] Reconnect button appears when connected

### Code Quality Validation

- [ ] Follows existing IntegrationsTab patterns exactly
- [ ] State variable naming matches Google Meet pattern
- [ ] Handler function naming matches Google Meet pattern
- [ ] Import statements organized correctly
- [ ] No unused imports or variables

### Regression Validation

- [ ] Fathom integration still works (connect/reconnect)
- [ ] Google Meet integration still works (connect)
- [ ] Source Priority Modal still works with existing integrations
- [ ] Loading state displays correctly
- [ ] Error handling works (try disconnecting, try bad OAuth)

---

## Anti-Patterns to Avoid

- ❌ Don't create new Edge Functions - they already exist
- ❌ Don't modify zoom-api-client.ts - it's already complete
- ❌ Don't modify ZoomSetupWizard.tsx - it's already complete
- ❌ Don't add Zoom functions to api-client.ts - use zoom-api-client.ts
- ❌ Don't change database schema - columns already exist
- ❌ Don't over-engineer - this is simple UI wiring only

---

## Confidence Score: 9/10

**Reasoning**:
- All backend infrastructure is verified complete and tested
- Frontend components (ZoomSetupWizard) already exist and are complete
- Changes are minimal (~100 lines) and follow exact existing patterns
- No external dependencies or new integrations required
- Only risk is typos or minor integration bugs

**Implementation Time Estimate**: 30-45 minutes

**Files Modified**: 4 files, ~100 lines total
1. `src/App.tsx` - 1 line added
2. `src/pages/OAuthCallback.tsx` - ~10 lines modified
3. `src/components/settings/IntegrationsTab.tsx` - ~80 lines added/modified

---

## Post-Implementation Notes

After completing this PRP:
1. Test with actual Zoom account
2. Verify webhook endpoint works (for auto-sync on new recordings)
3. Consider adding Zoom to sync page for manual meeting imports
4. Update user documentation to include Zoom setup instructions
