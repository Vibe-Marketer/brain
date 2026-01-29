# Phase 3: Integration OAuth Flows - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix Zoom OAuth connection flow (currently returns "non-200 error" after completing OAuth). Verify Google Meet OAuth works. Mark Google Meet as beta/experimental due to limited testability (requires paid Google Meet tier).

**Important context:** Fathom is the primary/original integration and already works. The sync tab UI, connection indicators, branded icons, and import workflow already exist and function. This phase is specifically about fixing the Zoom OAuth callback error and ensuring Google OAuth is stable enough for beta.

</domain>

<decisions>
## Implementation Decisions

### Connection Entry Points
- Settings/Integrations page is primary location (already exists)
- Also available during onboarding (strongly encouraged but skippable via small "Skip" link, not prominent button)
- Also available from empty states when user has no calls
- All three integrations (Fathom, Zoom, Google) shown equally in empty states — no hierarchy
- OAuth opens in popup window, main page stays open and updates when done

### Connected State Display
- Show account email/name identifying which account is connected
- Show last sync time ("Last synced 2 hours ago")
- Show call count ("42 calls imported")
- Show sync status indicator with icon + text (spinner/checkmark/warning + "Syncing"/"Up to date"/"Error")
- Manual sync triggered via existing "Import" button in sidebar (opens sync tab at `/?tab=sync`)

### Error Communication
- Claude's discretion on error display mechanism (toast vs inline vs modal) based on existing patterns
- Error messages are user-friendly + include error code: "Couldn't connect to Zoom (Error 401). Please try again."
- No special retry button — user clicks Connect again to retry
- Different messaging for connection errors vs sync errors ("Couldn't connect to Zoom" vs "Connected but sync failed")

### Disconnection Flow
- Requires confirmation dialog
- Dialog shows call count: "You have 47 calls from Zoom."
- Offers checkbox option to delete imported calls (not automatic)
- Reconnecting same account is seamless — picks up where left off
- Existing sync UI already shows what's imported vs available for import

### Integration Priority
- Zoom: Primary focus — fix the non-200 error on OAuth callback
- Google Meet: Mark as "beta" or experimental in UI due to limited testability
- Fathom: Already works — no changes needed

### Claude's Discretion
- Error display mechanism (toast, inline, or modal)
- Technical approach to fixing Zoom OAuth callback
- How to visually mark Google Meet as "beta"
- Exact wording of confirmation dialogs

</decisions>

<specifics>
## Specific Ideas

- The sync tab already exists at `/?tab=sync` with branded icons for each integration
- Import button in sidebar is the manual sync trigger — that workflow is established
- Sync UI already shows which calls are imported vs available, preventing duplicates on reconnect
- Current Zoom error is specifically "non-200 error" after completing OAuth in popup

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-integration-oauth*
*Context gathered: 2026-01-28*
