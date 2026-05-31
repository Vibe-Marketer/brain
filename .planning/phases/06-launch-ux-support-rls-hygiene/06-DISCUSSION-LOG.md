# Phase 6: Launch UX + Support + RLS Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 6-Launch UX + Support + RLS Hygiene
**Areas discussed:** First-run launch path, Empty-state CTAs, Support popout, Billing and upgrade flow, RLS hygiene gate, Optional connector resync

---

## Folded Todos

| Todo | Decision | Notes |
|------|----------|-------|
| Resync updated Fathom call metadata | Folded as optional add-on | Provider-to-CallVault resync may be included as launch polish, primarily Fathom-first. |
| Research compliance certifications readiness | Not folded | Too broad for Phase 6. |
| Apply 15-min compliance posture fixes | Not folded | Only allowed if required by RLS gate or trivially launch-blocking. |

---

## First-Run Launch Path

| Option | Description | Selected |
|--------|-------------|----------|
| Guided setup wizard | Keep the chain tight from signup to workspace to connector/import to first vault result. | |
| Main app with checklist | More flexible, but easier for a stranger to stall on an empty screen. | |
| Import/Connect directly | Fast route to value, but can skip setup context. | |
| Existing trial path + first connector import | Preserve current signup/setup/trial concept and land on first connector import. | ✓ |

**User's choice:** Existing trial path plus first connector import.
**Notes:** User described sign in/sign up, setup questions, connect first account, trial/credit-card page with exit, then land on first connector import page.

### First Import Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt to sync all | Show all-time library and make Sync all primary. | ✓ |
| Auto-sync all | Start importing everything immediately. | |
| Smart default | Auto-select recent window and offer all history. | |

**User's choice:** Show the all-time library and make `Sync all` the primary action.
**Notes:** User explicitly chose not to auto-import everything without confirmation.

### Education Layer

| Option | Description | Selected |
|--------|-------------|----------|
| Inline video first | Video prominently above/beside first import action. | |
| Import first, help nearby | Sync all dominant, help/video nearby. | |
| Tour prompt after sync starts | Offer tour/video while records import. | |
| One-time founder video after trial | Auto-show main video after trial setup, then continue to import. | ✓ |

**User's choice:** One-time founder video after trial setup.
**Notes:** User can record the main video. Per-feature videos are deferred as a likely Phase 07 layer.

### Video Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| One-time modal, then Support | Auto-open once, then house it in Support/How It Works. | ✓ |
| Small dismissible prompt | Keep compact prompt near Sync all until dismissed. | |
| Always in page header | Consistent video/help action in Pane 3 headers. | |

**User's choice:** One-time modal, then Support.

---

## Empty-State CTAs

| Option | Description | Selected |
|--------|-------------|----------|
| Action-first empty states | One primary CTA that creates value immediately. | ✓ |
| Explain-then-action | More education, more text. | |
| Guided checklist empty states | Route back to setup/tour. | |

**User's choice:** Action-first empty states.

### Empty Calls CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Connect a source | Best fit for launch promise. | ✓ |
| Import transcript | Good manual fallback. | |
| Connect or import | Offers both but splits attention. | |

**User's choice:** `Connect a source`.

### Empty Structure Surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Create local structure | Create workspace/folder/contact. | |
| Populate from calls first | Encourage sync/import first. | ✓ |
| Mixed by surface | Workspaces/folders create; contacts populate from calls. | ✓ |

**User's choice:** Mix of populate-first and surface-specific create CTAs.
**Notes:** Onboarding should bias toward real call data first; structure-management surfaces can still create local objects.

---

## Support Popout

| Option | Description | Selected |
|--------|-------------|----------|
| CC Andrew on all launch tickets | Best early visibility, noisier. | |
| CC Andrew on billing/Pro/Team only | Keeps high-value issues visible. | |
| No CC by default | Support inbox only. | ✓ |

**User's choice:** No CC by default.

### Ticket Context

| Option | Description | Selected |
|--------|-------------|----------|
| Basic context only | Current URL, user/org/workspace IDs, browser/user agent, version/commit if available. | ✓ |
| Basic + console errors | Adds recent frontend console errors. | |
| Depends on ticket type | Bug reports attach more context. | |

**User's choice:** Basic context only, with optional extras only if already easy.
**Notes:** Keep ticket submission simple. Primary data is contact info plus current state/window context.

### Popout Contents and Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar anchored support popout | Support icon near bottom of sidebar opens a small action list beside it. | ✓ |
| Full support page | Larger support area. | |
| Bottom-right chat widget | Real-time support chat. | |

**User's choice:** Sidebar anchored support popout.
**Notes:** Action list: Watch the Onboarding Video, Take the Tour, How It Works, Support Docs, Submit a Ticket. Future support chat and richer guide/video hub deferred.

---

## Billing and Upgrade Flow

| Option | Description | Selected |
|--------|-------------|----------|
| At action attempt | Paywall appears only when user clicks gated action. | |
| Visible locked affordances | Show features in place with lock badges. | |
| Both | Show locked affordances and trigger upgrade on action. | ✓ |

**User's choice:** Both, after asking for recommendation.
**Notes:** Agent recommended both because it shows value without forcing pricing screens too early.

### Post-Upgrade Landing

| Option | Description | Selected |
|--------|-------------|----------|
| Back to gated action | Resume what they were trying to do. | ✓ |
| Success page, then continue | Separate confirmation page. | |
| Toast/modal success over same page | Confirm upgrade in context. | |

**User's choice:** Back to gated action, using simplest practical implementation.

---

## RLS Hygiene Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Strict 9-table gate | Add only roadmap's missing `CROSS_ORG_TABLES`. | ✓ |
| 9 tables + test blockers | Fix minimum blockers that prevent meaningful coverage. | ✓ |
| Broader pre-launch security pass | Adjacent security/compliance hardening too. | |

**User's choice:** Primarily strict 9-table gate plus minimum test blockers. Minimal broader hardening only if required.

---

## Optional Connector Resync

| Option | Description | Selected |
|--------|-------------|----------|
| Connector Manage/detail only | Maintenance action in connection detail. | |
| Individual call/import-list level | Show resync state when a remote changed call appears in searched provider results. | ✓ |
| Both connector-level and call-level | Batch connector resync and one-record refresh. | |

**User's choice:** Call/import-list level, not connector-level.
**Notes:** Remote-changed already-synced calls should not appear fully grayed out and should not appear as brand-new green available calls. They need a third state.

### Resync Overwrite Rule

| Option | Description | Selected |
|--------|-------------|----------|
| Provider-owned fields only | Refresh provider title/status/metadata/transcript if changed; do not overwrite local notes/tags/folders. | ✓ |
| Everything provider can supply | Provider truth wins. | |
| Ask before sensitive overwrite | Prompt on transcript/title conflicts. | |

**User's choice:** Provider-owned fields only.

### Resync Rollout

| Option | Description | Selected |
|--------|-------------|----------|
| Fathom-first pattern | Build Fathom first, leave adapter pattern. | ✓ |
| All supported easy connectors | Include providers with easy change signals. | ✓ |
| Research first, implement cheap providers | Investigate each provider and include low-risk ones. | ✓ |

**User's choice:** Fathom-first, maybe more if easy.
**Notes:** Primary scenario is Fathom title/name update. Secondary scenario is Fathom trimming/cutting causing transcript/duration changes. If transcript/duration is hard, ship title updates first.

---

## the agent's Discretion

- Exact empty-state labels and support popout primitive.
- Exact Polar return mechanics, as long as the same action/surface is restored simply.
- Exact provider resync change-detection mechanics, with Fathom title changes as the first target.

## Deferred Ideas

- Per-feature video prompts/modal help across major app areas.
- Full onboarding guide/tour hub with section videos.
- Bottom-right support chat.
- CallVault-to-provider push sync.
- Deep transcript/duration resync if expensive.
