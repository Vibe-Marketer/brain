# CallVault Upgrade Prompts — Design Specification

**Status:** Locked — v2 canonical upgrade UX reference
**Last Updated:** 2026-02-27
**Covers:** BILL-04
**Reference:** PRICING-TIERS.md (limits and tier boundaries)

---

## 1. Design Philosophy

Upgrade prompts in CallVault follow three rules, applied without exception:

**Rule 1: Appear only at the point of limit hit.**
Upgrade prompts appear exactly where and when the user hits a limit. Not in a global sidebar. Not on the dashboard. Not in a banner. The user must be attempting the blocked action when the prompt appears. Context-aware prompts convert at up to 350% higher rates than generic upgrade messages — the specificity is the mechanism, not an aesthetic choice.

**Rule 2: Every prompt follows the three-behavior pattern.**
Every upgrade prompt — without exception — must do all three of the following:
1. **Explain the block.** Tell the user exactly why they cannot proceed right now.
2. **Show the unlock.** Tell the user exactly what upgrading gives them in this specific context.
3. **Present one CTA + one dismiss.** A clear primary action and an explicit "Maybe later" secondary. No third option. No ambiguity.

**Rule 3: Tone is educational, never punitive.**
Users are not being punished. They are being shown an opportunity. The difference is in the framing:
- Wrong: "You can't do this on the Free plan."
- Right: "You've reached your 10-call limit this month."
- Wrong: "This feature requires an upgrade."
- Right: "MCP access lets you connect Claude to your calls — it's available on Pro and Team."

The user should leave an upgrade prompt feeling informed, not blocked. If they click "Maybe later," they should understand exactly what they're deferring.

**Additional constraints:**
- No "AI-powered" language in any prompt copy
- No punitive language ("blocked," "restricted," "forbidden," "locked out")
- "Maybe later" is always the secondary option — not "No thanks," "Cancel," or "Dismiss"
- Primary CTA adapts based on trial state: "Start free trial" (trial available) vs. "Upgrade to [Pro/Team]" (trial already used)
- Prompts do not reappear mid-session after "Maybe later" — they reappear on the next attempt

---

## 2. Import Limit Prompt (Free to Pro)

**Trigger:** Free user attempts to import a call when they have already imported 10 calls in the current calendar month (UTC boundaries).

**Where:** Import flow — specifically the import confirmation step, immediately before the import would be executed. The call is not imported when the prompt fires.

---

### Copy

**Headline:** "You've reached your 10-call limit this month"

**Body:** "Free plan includes 10 imports per month. You've used all 10 this month. Your limit resets on [first of next month, formatted as Month D]."

**Unlock preview:** "Pro gives you unlimited imports every month — plus MCP access to connect your AI to your calls — for $29/month."

**Primary CTA:** "Start free trial" (if trial not yet used) → opens Trial Opt-In Modal
OR
"Upgrade to Pro" (if trial already used) → goes to billing/plan settings page

**Secondary:** "Maybe later" → dismisses prompt; import is not executed; user returns to import flow with counter visible

---

### Behavior

- **On "Maybe later":** Import is blocked for this session attempt. User returns to wherever they initiated the import. The 10 existing calls are untouched. The import limit counter shows X/10 for this month.
- **On "Start free trial" or "Upgrade to Pro":** Follow trial or upgrade flow. Import attempt is preserved — after successful upgrade/trial start, re-trigger the import automatically or prompt user to try again.
- **Data:** Nothing is lost. The 10 already-imported calls remain fully accessible.
- **Counter reset:** Import counter resets to 0 at the start of each calendar month (UTC midnight, first of month).

---

## 3. Workspace Limit Prompt (Free to Pro)

**Trigger:** Free user attempts to create a second workspace (they already have 1 workspace).

**Where:** Workspace creation dialog — specifically when the user clicks "New Workspace" or equivalent. The dialog opens, the user may enter a name, and on submission the prompt fires instead of creating the workspace.

Alternatively: The prompt fires immediately when the "New Workspace" button is clicked, before the creation dialog opens. (Implementation preference: fire before the dialog — saves the user effort of naming something they cannot yet create.)

---

### Copy

**Headline:** "Multiple workspaces are a Pro feature"

**Body:** "Free plan includes 1 workspace. You're currently using: [current workspace name]. Pro lets you create multiple workspaces to organize calls by client, project, or deal stage."

**Unlock preview:** "Pro gives you unlimited workspaces plus MCP access for $29/month. Your existing workspace and all its calls stay exactly as they are."

**Primary CTA:** "Start free trial" (if trial not yet used) → opens Trial Opt-In Modal
OR
"Upgrade to Pro" (if trial already used) → goes to billing/plan settings page

**Secondary:** "Maybe later" → dismisses prompt; workspace is not created; user stays on current workspace

---

### Behavior

- **On "Maybe later":** Workspace is not created. User remains on their current workspace. No state is changed.
- **On "Start free trial" or "Upgrade to Pro":** Follow trial or upgrade flow. After successful upgrade/trial start, prompt user to complete workspace creation or auto-return to workspace creation flow.
- **Data:** The existing workspace and all calls are preserved regardless of what the user chooses.

---

## 4. MCP Access Prompt (Free to Pro)

**Trigger:** Free user navigates to MCP settings, or clicks to generate an MCP token, or clicks any MCP-related configuration option.

**Where:** Workspace Settings > MCP section (or wherever the MCP config UI lives in the settings). The MCP settings area is visible but shows a locked state for Free users. The prompt fires when the user interacts with any locked element.

---

### Copy

**Headline:** "Connect your AI to your calls with MCP"

**Body:** "MCP lets Claude, ChatGPT, Gemini, and other AI tools access your calls directly. Ask questions about any call, across your entire workspace. It's available on Pro and Team plans."

**Unlock preview:** "Pro gives you full personal MCP access — generate a token, add it to your AI, and your calls are instantly available. $29/month."

**Primary CTA:** "Start free trial" (if trial not yet used) → opens Trial Opt-In Modal
OR
"Upgrade to Pro" (if trial already used) → goes to billing/plan settings page

**Secondary:** "Maybe later" → dismisses prompt; MCP settings remain in locked state

---

### Behavior

- **On "Maybe later":** MCP settings page remains visible but in locked state. All MCP config options show a lock indicator. No token is generated.
- **On "Start free trial" or "Upgrade to Pro":** Follow trial or upgrade flow. After successful upgrade/trial start, MCP settings become fully interactive.
- **For v1 users being migrated:** Existing MCP token configs may be visible in the settings panel but marked as inactive. A note explains: "Your MCP token is inactive on the Free plan. Upgrade to Pro to re-enable." This is not a new upgrade prompt — it's a status message in the settings UI.

---

## 5. Team Feature Prompts (Pro to Team)

Pro users have unlimited imports, multiple workspaces, and full personal MCP access. The three Team upgrade triggers are collaboration-specific. When a Pro user hits one of these, the prompt fires.

The CTA pattern for Pro-to-Team prompts:
- "Start Team trial" (if Team trial not yet used) → opens Trial Opt-In Modal (Team)
- "Upgrade to Team" (if Team trial already used) → goes to billing/plan settings page

---

### 5a. Invite Teammate Prompt

**Trigger:** Pro user attempts to invite another user to their workspace (clicks "Invite," "Add member," or equivalent).

**Where:** Workspace settings member management area, or invite flow dialog.

**Headline:** "Invite your team with Team plan"

**Body:** "Team plan adds shared workspaces with role-based access — so you can invite teammates as Viewers, Members, or Admins. Each person's access is scoped to the workspaces you choose."

**Unlock preview:** "Team plan: $79/month flat for unlimited members. Invite your reps, share your call library, manage access from one admin dashboard."

**Primary CTA:** "Start Team trial" OR "Upgrade to Team"

**Secondary:** "Maybe later"

**On "Maybe later":** Invite flow is cancelled. User returns to workspace settings. No invitation is sent.

---

### 5b. Multiple Organizations Prompt

**Trigger:** Pro user attempts to create a second organization.

**Where:** Organization creation flow (wherever "New Organization" or equivalent exists in settings or workspace navigation).

**Headline:** "Multiple organizations are a Team feature"

**Body:** "Pro plan includes 1 organization. Team plan lets you create multiple organizations — useful for agencies managing client accounts, or companies with multiple divisions, each with their own workspaces and members."

**Unlock preview:** "Team plan: $79/month flat. Separate organizations, separate billing views, separate admin controls — all from one account."

**Primary CTA:** "Start Team trial" OR "Upgrade to Team"

**Secondary:** "Maybe later"

**On "Maybe later":** Organization is not created. User stays in their current organization context.

---

### 5c. Per-Workspace MCP Token Prompt

**Trigger:** Pro user attempts to generate a workspace-scoped MCP token (distinct from their personal MCP token, which they already have on Pro).

**Where:** MCP settings, specifically the "Per-workspace token" or "Team MCP" section — distinct from the personal token section.

**Headline:** "Per-workspace MCP tokens are a Team feature"

**Body:** "Your personal MCP token gives your AI access to all your calls. Team plan adds per-workspace tokens — so each workspace gets its own dedicated MCP connection with scoped access. Useful when team members should see different calls."

**Unlock preview:** "Team plan: $79/month flat. Each workspace gets its own token. Team members working in Workspace A see only those calls in their AI."

**Primary CTA:** "Start Team trial" OR "Upgrade to Team"

**Secondary:** "Maybe later"

**On "Maybe later":** Per-workspace token is not generated. User retains their personal MCP token and access.

---

## 6. Trial Opt-In Modal

**Trigger:** Any upgrade prompt primary CTA click when the user has not yet used their trial for that tier.

**Where:** Modal overlay, centered on screen, with dimmed background. Appears above the current page context.

---

### Copy (Free to Pro Trial)

**Headline:** "Start your 14-day free trial of Pro"

**Body:** "Try all Pro features free for 14 days — unlimited imports, multiple workspaces, full MCP access. No credit card required. After 14 days, you'll return to Free automatically. Your data stays safe either way."

**Primary CTA:** "Start free trial" → initiates Polar trial subscription

**Secondary:** "Not now" → dismisses modal; user returns to the upgrade prompt (which still shows "Start free trial")

---

### Copy (Pro to Team Trial)

**Headline:** "Start your 14-day free trial of Team"

**Body:** "Try all Team features free for 14 days — invite teammates, shared workspaces, per-workspace MCP tokens, admin dashboard. No credit card required. After 14 days, you'll return to Pro automatically. Your data stays safe either way."

**Primary CTA:** "Start free trial" → initiates Polar trial subscription

**Secondary:** "Not now" → dismisses modal; user returns to the upgrade prompt

---

### Behavior

- **On "Start free trial":**
  1. Polar trial subscription is created (backend call)
  2. Toast notification appears: "You're on [Pro/Team] until [date, formatted as Month D, YYYY]. Enjoy!"
  3. Feature immediately unlocked — user proceeds with the action they originally attempted (import resumes, workspace creation dialog opens, MCP settings unlocks, etc.)
  4. Trial state is stored in Polar subscription metadata
- **On "Not now":** Modal closes. User is returned to the underlying upgrade prompt. The prompt still shows "Start free trial" — the trial window has not been consumed.
- **Trial start date:** The day the user clicks "Start free trial" — not the day they first saw an upgrade prompt.
- **Trial non-recurrence:** Each tier trial (Free-to-Pro, Pro-to-Team) can only be used once per account. After a trial ends, the CTA changes to "Upgrade to [tier]" permanently.

---

## 7. Post-Trial Downgrade Messaging

**Trigger:** Trial period ends (Polar subscription expires/downgrades).

**Timing:** The messaging fires when the trial period ends, not when the user next logs in. However, the in-app banner appears on first login after trial ends (since the app may not be open at the exact expiration time).

---

### Immediate Toast (on trial end detection)

**Toast message:** "Your 14-day [Pro/Team] trial has ended. Your data is safe."

**Duration:** Toast stays visible for 8 seconds (longer than standard — this is important information). No auto-dismiss action required from user.

---

### First Login Banner (after trial ends)

**Where:** A dismissible banner at the top of the main app view, displayed once per user on their first login session after trial expiry.

**Headline:** "Your trial ended. Your data is safe."

**Body (Free to Pro downgrade):**
"You're now on Free: 10 calls/month, 1 editable workspace, no MCP access. Your calls are all here and searchable. [Additional workspaces] are now read-only."

**Body (Team to Pro downgrade):**
"You're now on Pro: unlimited imports, multiple workspaces, personal MCP access. Your shared workspaces are now read-only. Team features are unavailable until you upgrade."

**Primary CTA:** "Upgrade to [Pro/Team]" → goes to billing/plan settings page

**Secondary:** "View plan details" → goes to Settings > Your Plan section

**Dismiss:** X button in banner corner. Dismissing hides the banner permanently (does not reappear on subsequent logins).

---

### Post-Trial State: What Changes

**Downgrading from Pro to Free:**

| What | State After Downgrade |
|------|----------------------|
| Existing calls (all 10 already imported) | Fully accessible — read, search, export, share |
| Additional workspaces (if any were created during trial) | Read-only. Viewable and searchable; cannot add/edit calls or folders |
| Active workspace | User picks 1 workspace to keep fully editable on next session |
| MCP configs | Visible in settings but inactive. Token connection blocked. Existing token visible with "Inactive on Free plan" label |
| New imports | Counter resets to 0/10 for current month |
| Smart Import | Continues on all new imports within the 10/month limit |

**Workspace selection flow (Pro to Free, when >1 workspace exists):**
On first login after downgrade, if the user has more than 1 workspace, a single-step dialog appears:
- "You're back on Free. Choose your active workspace — calls in other workspaces will be read-only."
- List of workspaces with call counts
- "Select" button per workspace
- No "Cancel" — user must make a selection to proceed
- After selection: the chosen workspace is fully editable; all others are read-only

**Downgrading from Team to Pro:**

| What | State After Downgrade |
|------|----------------------|
| Personal MCP access | Remains fully active |
| Per-workspace MCP tokens (Team-only) | Token configs visible, connections blocked. Label: "Shared workspace tokens require Team plan." |
| Shared workspaces (multi-user) | Read-only for the account holder. Other members still see them if still on Team. (Edge case: handle if Team plan is cancelled entirely.) |
| Roles and permissions | Settings become read-only; no new invites can be sent |
| Admin dashboard | Access removed |
| Consolidated billing | Access removed; user sees standard Pro billing view |

---

## 8. Settings "Your Plan" Section

**Location:** Settings page, always visible. This is a persistent section — not a one-time notification. Every user at every tier sees this section.

---

### For Free Users

**Section header:** "Your Plan: Free"

**Content:**
- Plan name: "Free" with a "Upgrade" badge/button in the header row
- Usage bars:
  - Imports this month: [X] / 10 (progress bar, turns amber at 8/10, red at 10/10)
  - Workspaces: [X] / 1
  - MCP access: "Not available on Free"
- Upgrade CTA: "Upgrade to Pro — $29/month or $23/month billed annually"
  - Clicking opens billing flow (not trial modal — this is a direct upgrade path)
- Trial CTA (if trial not yet used): "Or try Pro free for 14 days" (secondary link text, smaller)
- Billing details: Not applicable on Free

---

### For Pro Users (Active)

**Section header:** "Your Plan: Pro"

**Content:**
- Plan name: "Pro" with "Manage" link
- Usage summary (no hard limits to display):
  - Imports this month: [X] (no cap indicator)
  - Workspaces: [X] active
  - MCP: "[X] token(s) configured"
- Upgrade path: "Upgrade to Team — $79/month or $63/month billed annually"
  - Clicking opens billing flow for Team
- Trial CTA (if Team trial not yet used): "Or try Team free for 14 days" (secondary link text)
- Billing details: "Next billing date: [date]" | "Manage billing" link → Polar customer portal

---

### For Team Users (Active)

**Section header:** "Your Plan: Team"

**Content:**
- Plan name: "Team" with "Manage" link
- Usage summary:
  - Imports this month: [X] (across all team members)
  - Workspaces: [X] active (including shared)
  - Team members: [X] active members
  - MCP: "[X] workspace token(s) configured"
- Billing details: "Next billing date: [date]" | "Manage billing" link → Polar customer portal
- No upgrade path shown (Team is the top tier)

---

### For Trial Users

**Section header:** "Your Plan: [Pro/Team] Trial"

**Sub-header (amber indicator):** "Trial active — ends [date]"

**Content:**
- Trial status: "You have [N] days remaining in your [Pro/Team] trial."
- All usage displays same as active paid tier
- CTA: "Subscribe to keep [Pro/Team]" → opens billing flow (converts trial to paid subscription)
- Secondary: "View plan details" → shows what happens after trial ends (links to downgrade behavior explanation)

---

## 9. Implementation Notes for Developers

These notes are for Phase 14+ developers implementing the billing and gating system.

### Architecture

**UpgradeGate component pattern:**
All upgrade prompts are delivered through a shared `UpgradeGate` component. The pattern:

```
<UpgradeGate
  feature="workspace-create"           // trigger identifier
  requiredTier="pro"                   // minimum tier needed
  onUnlocked={() => openCreateDialog()} // callback after upgrade/trial
>
  <Button onClick={() => {}}>New Workspace</Button>
</UpgradeGate>
```

When the wrapped action fires, `UpgradeGate` checks the user's current tier. If insufficient, it renders the upgrade prompt instead of executing the `onClick`. If sufficient, it passes through normally.

This keeps gating logic out of individual components. New limits can be added by wrapping any feature with `UpgradeGate` without touching the component itself.

### Copy Storage

All prompt copy (headlines, body text, CTAs) is stored as constants in a single file — e.g., `src/constants/upgrade-copy.ts`. Components import the constants rather than hardcoding strings. This enables rapid copy iteration without touching component code.

Structure recommendation:
```
UPGRADE_COPY = {
  importLimit: { headline, body, unlockPreview, ctaTrial, ctaUpgrade },
  workspaceLimit: { headline, body, unlockPreview, ctaTrial, ctaUpgrade },
  mcpAccess: { headline, body, unlockPreview, ctaTrial, ctaUpgrade },
  // ... etc.
}
```

### Trial State

Trial state is sourced from Polar's subscription metadata. The frontend must:
1. Check if the user has an active Polar subscription (any tier)
2. Check if the subscription is in trial state
3. Check trial expiry date
4. Check if a Pro trial has ever been used (to determine CTA label)
5. Check if a Team trial has ever been used (to determine CTA label)

Do not track trial state in local React state or localStorage — it must come from Polar. Local state is only appropriate for optimistic UI updates (e.g., immediately showing Pro features while the Polar API call completes).

### Import Counter

- Counter tracks imports per calendar month, per user
- Month boundaries use UTC (not local time) — first day of each month at 00:00:00 UTC
- Counter is stored server-side (not in localStorage)
- Free tier is enforced both frontend (UpgradeGate fires before import executes) and backend (import edge function checks counter and returns 402 with structured error if limit hit)
- "Maybe later" dismisses for the current session only — prompt reappears on the next import attempt in the same or a future session

### Frontend vs. Backend Gating

Upgrade prompts are a frontend UX layer. They are not the security boundary. Backend enforcement is required separately:

| Limit | Frontend (UpgradeGate) | Backend Enforcement |
|-------|----------------------|---------------------|
| Import limit | Fires before import | Edge function checks counter, returns 402 |
| Workspace limit | Fires before creation | API returns 403 with error code |
| MCP token generation | Fires before generation | Token generation endpoint checks tier |
| Team invite | Fires before invite | Invite endpoint checks tier |

The frontend UpgradeGate is for UX — it shows the prompt early, before the backend call, to avoid unnecessary network requests. But even if someone bypasses the frontend, the backend must still enforce limits.

### Dismiss Behavior

"Maybe later" dismisses the prompt for the current browser session. If the user refreshes or closes and reopens the app, and they try the same action again, the prompt reappears. This is intentional — persistent dismissal would allow users to repeatedly attempt blocked actions without seeing the upgrade path.

Implementation: Use a session-level flag (React context or sessionStorage, cleared on page load) to track "this prompt was dismissed this session." On next attempt in same session, skip prompt. On next attempt in new session, show prompt again.

### Workspace Selection Flow (Post-Trial)

The workspace selection flow (choosing 1 active workspace on downgrade from Pro to Free) must be triggered server-side by the Polar webhook `subscription.updated` event. When the subscription downgrades:
1. Backend receives Polar webhook
2. Backend marks additional workspaces as read-only
3. On next frontend load, the app detects the downgrade state and shows the workspace selection dialog
4. User selects their active workspace via a backend call
5. Backend updates workspace permissions accordingly

This flow must handle the edge case where the user doesn't log in for an extended period after trial expiry — their workspace state should be consistent when they return.

---

*Document status: Locked — v2 canonical upgrade UX reference*
*Created: 2026-02-27*
*Author: Phase 13 Planning*
*Reference: PRICING-TIERS.md for tier limits; 13-03-PLAN.md for Polar product setup*
