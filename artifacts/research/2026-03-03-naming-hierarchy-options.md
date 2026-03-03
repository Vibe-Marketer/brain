# Options Comparison: CallVault Naming & Hierarchy

## Strategic Summary

Three naming decisions need to be made: (1) what to call the top-level "organization" container and its default name, (2) what to call the root nav section that shows all records, and (3) how to visually distinguish import-source workspaces from user-created ones. The research shows most world-class B2B apps use "Workspace" as the primary container (but CallVault already uses that term at the sub-level), favor "Home" for the root view, and use **position + locked behavior** (not badges) to signal system-created spaces.

**Also surfaced:** The current name "All Calls" is inaccurate — the app stores transcripts from many sources (calls, voice notes, uploads, YouTube). This needs to be addressed in whatever naming we choose.

---

## Current State (What's Actually in the Code)

| Element | Current Name | Where It Appears |
|---------|-------------|-----------------|
| Top-level container | "Organization" | Org switcher, create dialog, TopBar |
| Default personal org | "Personal" (hardcoded in DB trigger) | Org switcher dropdown |
| Business org default | "{orgName}'s Vault" (from RPC) | Org switcher dropdown |
| Root nav item (sidebar) | "All Calls" | SidebarNav.tsx |
| Root nav item (topbar) | "HOME" | TopBar.tsx (orange label) |
| Default personal workspace | "My Calls" | DB trigger, sidebar |
| Import workspaces | No visual distinction | Same as custom workspaces |
| Workspace types in DB | personal, team, youtube | workspace_type constraint |

**Bugs found during research:**
- TopBar says "HOME" but sidebar says "All Calls" for the same route — mismatch
- Frontend still queries old table names (`vaults`, `banks`) — types not regenerated
- `workspaces.service.ts` inserts `vault_type: 'business'` which doesn't exist in DB constraint

---

## Decision 1: Organization Default Name

### Context
When a user signs up, a "personal" organization is auto-created with the name "Personal." If they create a business org, it gets a custom name. The user's insight: most users will be businesses, so "Personal Organization" feels wrong as the default.

### Decision Criteria
1. **Immediate clarity** — User knows what this is without thinking. Weight: **High**
2. **Scales to teams** — Doesn't feel weird when you add team members. Weight: **High**
3. **Industry alignment** — Matches what users expect from other tools. Weight: **Medium**
4. **Minimal onboarding friction** — Doesn't require the user to name something before they can start. Weight: **Medium**

### Options

**Option A: "[User's Name]'s Workspace"**
- Immediate clarity: Good — feels personal and owned ("Alex's Workspace")
- Scales to teams: OK — gets renamed when it becomes a team, natural upgrade path
- Industry alignment: Strong — Linear, Slack, Notion all default to user/company name
- Onboarding friction: Low — auto-generated from sign-up name, no extra step
- **Score: 8/10**

**Option B: "My Workspace"**
- Immediate clarity: Good — obviously personal, zero ambiguity
- Scales to teams: Poor — "My Workspace" is awkward when others join. Forces a rename.
- Industry alignment: Weak — no major app defaults to "My [X]" for the top-level container
- Onboarding friction: None — fully automatic
- **Score: 5/10**

**Option C: Keep "Organization" but default to "[User's Name]'s Organization"**
- Immediate clarity: OK — "Organization" is formal, feels enterprise-y for a solo user
- Scales to teams: Good — "Organization" is a natural team container
- Industry alignment: Mixed — Asana uses "Organization" for business-domain signups, but most apps don't
- Onboarding friction: Low — auto-generated from name
- **Score: 6/10**

**Option D: "[User's Name]'s Team"**
- Immediate clarity: Good — "Team" implies collaboration, feels professional
- Scales to teams: Excellent — name already anticipates team use
- Industry alignment: Strong — Figma uses "Team," Fireflies uses "Team"
- Onboarding friction: Low — auto-generated
- Downside: Feels presumptuous for a solo user ("Alex's Team" when it's just Alex)
- **Score: 7/10**

### Comparison Matrix

| Criterion | "[Name]'s Workspace" | "My Workspace" | "[Name]'s Organization" | "[Name]'s Team" |
|-----------|---------------------|----------------|------------------------|----------------|
| Immediate clarity | Good | Good | OK | Good |
| Scales to teams | OK | Poor | Good | Excellent |
| Industry alignment | Strong | Weak | Mixed | Strong |
| Onboarding friction | Low | None | Low | Low |

### Recommendation: Option A — "[User's Name]'s Workspace"

**BUT** — there's a naming collision. CallVault already uses "Workspace" for the sub-level containers (YouTube workspace, Fathom workspace, custom workspaces). Having both "Alex's Workspace" (the organization) and "YouTube" (also a workspace) would be confusing.

**Two paths forward:**

1. **Rename the sub-level concept.** Call the sub-containers something else (e.g., "Spaces," "Channels," "Libraries," "Collections") and use "Workspace" for the top-level org. This aligns with industry standard but is a bigger change.

2. **Keep "Organization" as the concept, but fix the default name.** Call the default org **"[User's Name]'s Account"** or **"[Company Name]"** (asked during onboarding). This avoids the collision entirely.

**Practical recommendation: Option C-variant — Ask for company/team name during onboarding.** During sign-up, ask "What's your company or team name?" and use that as the org name. If they skip it, default to "[User's Name]'s Account." This is what Notion, Slack, and Linear all do, and it sidesteps the "Personal" / "Business" awkwardness entirely.

---

## Decision 2: Root Navigation Item Name

### Context
The sidebar's top nav item (route `/`) shows all transcripts across all workspaces. Currently labeled "All Calls" in the sidebar and "HOME" in the TopBar. The records are transcripts from diverse sources — not just calls.

### Decision Criteria
1. **Accurately describes what's there** — Doesn't mislead about content. Weight: **High**
2. **Instantly communicates "everything, unfiltered"** — User knows this is the master view. Weight: **High**
3. **Works when sources expand** — YouTube, voice notes, uploads, calls, etc. Weight: **High**
4. **Concise** — Short enough for a sidebar label. Weight: **Medium**
5. **Industry pattern match** — Familiar from other apps. Weight: **Low**

### Options

**Option A: "All Transcripts"**
- Accuracy: Excellent — that's literally what it is
- Communicates "everything": Strong — "All" prefix is clear
- Source-agnostic: Perfect — transcripts covers every source type
- Concise: Good — 15 chars, fits sidebar
- Industry: Matches Fireflies ("All Meetings"), HubSpot ("All Contacts") pattern
- **Score: 9/10**

**Option B: "Home"**
- Accuracy: Vague — doesn't tell you what's in it
- Communicates "everything": Weak — "Home" could mean dashboard, feed, or settings
- Source-agnostic: N/A — doesn't reference content type at all
- Concise: Excellent — 4 chars
- Industry: Most common (Notion, Slack, Airtable), but those apps show activity feeds, not record lists
- **Score: 5/10**

**Option C: "Library"**
- Accuracy: Good — implies a collection of stored items
- Communicates "everything": Medium — suggests completeness but isn't explicit
- Source-agnostic: Good — a library can hold anything
- Concise: Good — 7 chars
- Industry: Loom uses "Library" for their personal video collection
- Downside: Feels passive/archival, not like an active workspace
- **Score: 6/10**

**Option D: "All Records"**
- Accuracy: Good — generic enough to cover any content type
- Communicates "everything": Strong — "All" prefix is clear
- Source-agnostic: Good — "records" is neutral
- Concise: Good — 11 chars
- Industry: Less common, more database-y
- Downside: "Records" is vague — records of what? Doesn't tell a new user what the app is about
- **Score: 6/10**

**Option E: "[Org Name]" (dynamic)**
- Accuracy: Doesn't describe content at all
- Communicates "everything": Medium — implies "everything in this org" by being the org name
- Source-agnostic: Yes — no content type referenced
- Concise: Depends on org name length
- Industry: Loom uses "All [Workspace Name]" pattern
- Downside: Confusing — a nav item named after the org doesn't tell you what it shows
- **Score: 4/10**

### Comparison Matrix

| Criterion | "All Transcripts" | "Home" | "Library" | "All Records" | "[Org Name]" |
|-----------|-------------------|--------|-----------|---------------|-------------|
| Accuracy | Excellent | Vague | Good | Good | None |
| "Everything" signal | Strong | Weak | Medium | Strong | Medium |
| Source-agnostic | Perfect | N/A | Good | Good | Yes |
| Concise | Good | Excellent | Good | Good | Varies |
| Industry match | Strong | Strong | Medium | Weak | Weak |

### Recommendation: Option A — "All Transcripts"

This is the Fireflies/HubSpot pattern applied to CallVault's domain. It's accurate, immediately communicates "this is everything," and works regardless of source type. The TopBar label should match: "ALL TRANSCRIPTS" instead of "HOME."

**Runner-up: "Library"** — choose this if "All Transcripts" feels too clinical/database-y. "Library" has a warmer feel and Loom validates the pattern for media content apps.

---

## Decision 3: Import Source Workspaces vs. Custom Workspaces

### Context
When a user connects an import source (YouTube, Fathom, Zoom), a workspace is auto-created for that source with a specialized table. User-created workspaces use a generic table. The user wants it to be clear which workspaces are "locked" import-source workspaces vs. flexible custom ones.

### Decision Criteria
1. **Instantly distinguishable** — User can tell at a glance which is which. Weight: **High**
2. **Doesn't clutter the UI** — The distinction shouldn't add visual noise. Weight: **High**
3. **Communicates "you can't delete this"** — System workspaces are protected. Weight: **Medium**
4. **Scales to many sources** — Works when there are 2 or 10 import sources. Weight: **Medium**
5. **Industry-validated** — Proven pattern from other apps. Weight: **Low**

### Options

**Option A: Section Headers — "Sources" and "Workspaces"**

Split the sidebar workspace list into two labeled sections:
```
SOURCES
  YouTube
  Fathom
  Zoom

WORKSPACES
  Sales Team
  Product Research
  Q1 Reviews
```

- Distinguishable: Excellent — physically separated with clear labels
- Clutter: Low — section headers are subtle, standard UI pattern
- "Can't delete" signal: Strong — "Sources" implies system-managed
- Scales: Good — both sections grow independently
- Industry: Slack uses this pattern for "Slack Connect" vs. regular channels
- **Score: 9/10**

**Option B: Source Icon + Pinned Position (No Section Headers)**

Import-source workspaces show the source's brand icon (YouTube logo, Zoom logo, Fathom logo) and are always pinned to the top. Custom workspaces use a generic folder/workspace icon and appear below.
```
  [YouTube icon] YouTube
  [Fathom icon] Fathom
  [Zoom icon] Zoom
  ──────────────────────
  [folder icon] Sales Team
  [folder icon] Product Research
```

- Distinguishable: Good — icons + position signal the difference
- Clutter: Low — icons are small, divider line is subtle
- "Can't delete" signal: Medium — position suggests permanence but isn't explicit
- Scales: Good — icons self-identify each source
- Industry: Fireflies uses position + naming for system channels
- **Score: 7/10**

**Option C: Single List with Source Badge**

All workspaces in one flat list. Import-source workspaces have a small badge/tag like "Source" or the integration icon next to the name.
```
  YouTube [source badge]
  Fathom [source badge]
  Sales Team
  Zoom [source badge]
  Product Research
```

- Distinguishable: Medium — badges are subtle, easy to miss
- Clutter: Medium — badges on every source workspace adds visual noise
- "Can't delete" signal: Weak — a badge doesn't communicate locked behavior
- Scales: OK — but mixed list gets confusing with many items
- Industry: No major app uses badges for this purpose
- **Score: 4/10**

**Option D: Collapsible "Connected Sources" Group**

A collapsible group at the top of the workspace list, with a header and expand/collapse toggle:
```
v Connected Sources (3)
    YouTube
    Fathom
    Zoom

  Sales Team
  Product Research
  Q1 Reviews
```

- Distinguishable: Excellent — clearly grouped and labeled
- Clutter: Low when collapsed — user can hide sources they don't need to see often
- "Can't delete" signal: Strong — grouped under "Connected" implies system-managed
- Scales: Excellent — collapses when there are many sources
- Industry: Standard pattern for grouped sidebar items (Notion teamspaces, Slack channel sections)
- **Score: 8/10**

### Comparison Matrix

| Criterion | Section Headers | Icon + Position | Badge | Collapsible Group |
|-----------|----------------|-----------------|-------|-------------------|
| Distinguishable | Excellent | Good | Medium | Excellent |
| Low clutter | Low | Low | Medium | Low (collapsible) |
| "Can't delete" signal | Strong | Medium | Weak | Strong |
| Scales | Good | Good | OK | Excellent |
| Industry-validated | Strong | Strong | Weak | Strong |

### Recommendation: Option A — Section Headers ("Sources" / "Workspaces")

Clean, obvious, zero ambiguity. The user immediately understands the hierarchy. The labels themselves communicate the difference in behavior — "Sources" are where data comes from (system-managed), "Workspaces" are where you organize it (user-managed).

**Runner-up: Option D — Collapsible Group.** Choose this if the source list grows long (5+ sources) or if users rarely interact with source workspaces directly. The collapse mechanism keeps the sidebar clean.

**Hybrid (best of both):** Start with section headers (Option A). When/if the source list grows, add collapse behavior (Option D). This is progressive enhancement — simple now, scales later.

---

## Implementation Context

<claude_context>
<decision_1_org_naming>
- recommendation: Ask company/team name during onboarding, default to "[User's Name]'s Account" if skipped
- drop_type_distinction: Remove "personal" vs "business" org type in the UI. Internally keep the type for billing/features, but don't surface it as a label
- db_change: Update handle_new_user() to set org name to "{first_name}'s Account" instead of "Personal"
- frontend_change: Remove type-based naming in org switcher; show org name directly
- onboarding_change: Add "What's your company or team name?" step during sign-up flow
</decision_1_org_naming>

<decision_2_root_nav>
- recommendation: "All Transcripts" in both sidebar and TopBar
- rename_default_workspace: "My Calls" → "My Transcripts" (or remove if redundant with "All Transcripts")
- sidebar_change: SidebarNav.tsx — change label from "All Calls" to "All Transcripts"
- topbar_change: TopBar.tsx — change "HOME" to "ALL TRANSCRIPTS"
- route_consideration: Keep route as `/` (no URL change needed)
</decision_2_root_nav>

<decision_3_workspace_hierarchy>
- recommendation: Section headers — "Sources" and "Workspaces"
- sources_section: Auto-created, locked (can't delete/rename), source brand icon, pinned at top
- workspaces_section: User-created, fully editable, generic folder icon
- db_change: Add workspace_type values for each source (e.g., 'fathom', 'zoom') or use a boolean `is_source` flag
- sidebar_change: WorkspaceSidebarPane.tsx — split list into two sections with headers
- future: Add collapse behavior when source list exceeds 4-5 items
</decision_3_workspace_hierarchy>

<bugs_to_fix>
- Regenerate Supabase TypeScript types (frontend still uses old table names)
- Fix workspaces.service.ts vault_type: 'business' → should be 'team'
- Resolve TopBar/sidebar label mismatch for root route
</bugs_to_fix>
</claude_context>

---

## Sources

- [Notion Intro to Workspaces](https://www.notion.com/help/intro-to-workspaces)
- [Notion Navigate with the Sidebar](https://www.notion.com/help/navigate-with-the-sidebar)
- [Notion Intro to Teamspaces](https://www.notion.com/help/intro-to-teamspaces)
- [Figma Get Started with Organizations](https://help.figma.com/hc/en-us/articles/360039957374-Get-started-with-organizations)
- [Figma File Browser Guide](https://help.figma.com/hc/en-us/articles/14381406380183-Guide-to-the-file-browser)
- [Slack Workspace Name Help](https://slack.com/help/articles/201663443-Change-your-workspace-or-org-name-and-URL)
- [Slack New Design Overview](https://slack.com/help/articles/16764236868755-An-overview-of-Slacks-new-design)
- [Linear Workspaces Docs](https://linear.app/docs/workspaces)
- [Linear Conceptual Model](https://linear.app/docs/conceptual-model)
- [Airtable Home Screen](https://support.airtable.com/docs/airtable-home-screen)
- [Monday.com Structural Hierarchy](https://support.monday.com/hc/en-us/articles/7278527605906-Understanding-monday-com-s-structural-hierarchy)
- [Loom Use Spaces](https://support.loom.com/hc/en-us/articles/7324652635549-How-to-use-spaces)
- [Fireflies Notebook Organization](https://guide.fireflies.ai/articles/3673385838-how-to-organize-meetings-in-your-notebook)
- [Gong Workspace FAQ](https://help.gong.io/docs/faqs-for-workspaces)
- [HubSpot Navigation Guide](https://knowledge.hubspot.com/help-and-resources/a-guide-to-hubspots-navigation)
- [Asana Workspace vs Organization](https://help.asana.com/s/article/workspaces-and-organizations-faq)
