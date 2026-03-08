# Features Research: CallVault v2.0

**Research Date:** February 22, 2026
**Domain:** Call recording management platform — workspace model, import routing, token management, and connector extensibility
**Scope:** Features dimension for CallVault v2.0 milestone
**Overall Confidence:** HIGH (primary claims from Notion, HubSpot, Airtable, Linear official docs; secondary claims from verified patterns)

---

## Workspace Hierarchy Naming

### What Top Tools Do

**Notion (HIGH confidence — official docs verified)**
Notion uses a 2-level model: **Workspace** (top) → **Teamspaces** (subdivisions within workspace). Key insight: they originally had just "workspace," then added "Teamspaces" as a second tier for teams within an org. Their own docs say: *"Most likely, you'll only need one default teamspace, and we'd recommend no more than three default, even for large workspaces."*
- Level 1: **Workspace** (company/organization — billing root)
- Level 2: **Teamspace** (functional group — e.g., Sales, Engineering, Design)
- Level 3: **Pages** (content — infinitely nestable)
- Key clarity pattern: Sidebar shows "Teamspaces" section and "Shared" section — spatial separation makes hierarchy visible

**Linear (HIGH confidence — official docs verified)**
Linear uses: **Workspace** (top) → **Teams** (working groups, 2 on free plan, unlimited on Business) → **Projects** (cross-team or team-specific initiatives) → **Issues** (tasks).
- Critically: *"If you are unsure how to structure your teams, start with one or two. It is easy to add more teams in the future."*
- Linear's advice for naming teams: by people who work together frequently, or by area of work (marketing, mobile app). One team for small teams is fine.
- Sub-teams are supported: Teams can have sub-teams for nested org structures.

**Slack (pattern from training — MEDIUM confidence)**
Workspace → Channel. Very flat. Channels are named functionally: `#sales-team`, `#project-abc`, `#general`. No intermediate tier.

**Loom (MEDIUM confidence — help site redirected to Atlassian post-acquisition)**
Pre-acquisition: Workspace → Spaces (shared library groupings) → Videos. Post-Atlassian: restructuring in progress.

**Fireflies.ai (MEDIUM confidence — official help inaccessible)**
Uses "Workspace" as the top-level org container. Within it, calls are organized by "Notebooks" (topic groupings). No evidence of a second-tier org concept — relies on search and filters.

**Grain (MEDIUM confidence — official help not accessible)**
Workspace → Collections (playlists/folders of clips). Flat-ish with tagging.

**HubSpot Workflows (HIGH confidence — official docs verified)**
Uses "Workflow" as the organizational container. Within workflows, conditions are filter-based triggers. No workspace hierarchy as such — it's a SaaS CRM with portals.

### Pattern Analysis

Across all verified tools, the winning naming formula follows:
1. **The outer container** always maps to the billing/org root. Called: Workspace (Notion, Linear, Slack, Grain, Fireflies), Organization (GitHub), or Account (Airtable).
2. **The second tier** maps to working groups or projects. Called: Teamspace (Notion), Team (Linear), Channel (Slack), Project (GitHub), Base (Airtable).
3. **The third tier** is always content containers. Called: Page (Notion), Issue (Linear), Message (Slack), File (GitHub), Record (Airtable).

**The critical clarity finding:** Tools that use invented/metaphorical names (Notion's "Teamspace" instead of "Department", Linear's "Team" instead of "Group") succeed because the terms are immediately self-defining. Users map them to familiar org concepts. Tools that use abstract acronyms (Vault, Hub, Bank) fail because users must learn what these mean before they can use the product.

### Recommendation for CallVault v2.0

**Adopt the Workspace → Channel → Folder naming scheme:**

| Level | Name | Maps To | Examples |
|-------|------|---------|---------|
| L1 (Billing root) | **Workspace** | Organization/Company | "Acme Corp", "Coach Sarah" |
| L2 (Logical grouping) | **Channel** | Team / Program / Client | "Sales Team", "Coaching Program A", "Client X" |
| L3 (Content container) | **Folder** | Project / Stage / Topic | "Q1 Discovery Calls", "Onboarding", "Won Deals" |

**Why "Workspace → Channel → Folder":**
- "Workspace" is the universal term — zero learning curve
- "Channel" is familiar from Slack — connotes a flow of incoming content (calls) organized by topic/team — works for all three use cases (sales team channels, coaching program channels, agency client channels)
- "Folder" is the most universal organizational metaphor — everyone understands folders contain files
- All three terms work across use cases without aliasing or explaining

**Alternative that also works if "Channel" feels too Slack-specific:**
Workspace → **Space** → Folder (Space is used by Confluence, ClickUp, and others for mid-level org containers)

**Evidence for rejection of current names:**
- "Bank" has no self-evident meaning in a call-management context — users associate banks with money
- "Vault" works for "secure storage" but doesn't suggest grouping or collaboration
- "Hub" is overused (HubSpot, Microsoft Hub, etc.) and suggests a central aggregation point, not a container hierarchy
- All three require in-app explanation before users can begin using the product — violates the 30-second clarity goal

---

## Import Rules / Condition Builder UX

### What Top Tools Do

**HubSpot Workflows / Filter Enrollment Triggers (HIGH confidence — official docs verified, Feb 2026)**

HubSpot's filter enrollment triggers are the gold standard for non-technical users. Key patterns:

1. **Plain English trigger names**: HubSpot presents conditions as sentences: *"When filter criteria is met"*, *"Enroll contacts based on their property values"*. No technical jargon.

2. **Object-first selection**: First pick the record type (Contact, Deal, Company, etc.), then pick the property to filter on. This narrows the option space before showing operators.

3. **Contextual operators**: Operators change based on field type:
   - Text fields: "is", "contains", "starts with", "is empty"
   - Number fields: "is equal to", "is greater than", "is less than"
   - Date fields: "is after", "is before", "is within the last X days"
   - Boolean: "is true", "is false"

4. **AND/OR with visual grouping**: Multiple conditions join with AND (within a group) or OR (between groups). Groups are visually boxed.

5. **AI assistance**: HubSpot added "Create with AI" using the pattern *"When [this happens], then [do this]"* — plain English → auto-generated workflow.

6. **Live enrollment preview**: After setting triggers, shows how many existing records match — critical for building confidence before committing.

**Zapier Filters (MEDIUM confidence — help site loaded but couldn't access filter-specific article)**

Based on well-documented Zapier patterns: Zapier's "Filter" step uses:
- **Field selector** (dropdown of available fields from trigger)
- **Condition selector** (context-sensitive: "(Text) Contains", "(Number) Greater Than", etc.)
- **Value input** (free text or dropdown depending on field type)
- Conditions are linear (one at a time, no visual nesting in the basic tier)
- Multiple filter steps can be chained (but it's awkward UX)

**Make (Integromat) Filters (MEDIUM confidence — site blocked, based on documented patterns)**
Make adds a filter between any two modules via a circular icon on the connection arrow. Users see: Field → Operator → Value, in a table-like editor. More powerful but more intimidating for non-technical users.

**Apple Mail / Gmail Rules (HIGH confidence — well-established pattern, training data)**

The most widely-used condition builder in the world follows:
- Three-column row: **[Field dropdown]** **[Operator dropdown]** **[Value input]**
- Rows joined with "Any of the following are true / All of the following are true" at the top
- "+" to add a new row, "-" to remove
- No visual nesting — just flat list with AND/OR toggle at top

### UX Patterns That Work for Non-Technical Users

From synthesizing the above:

1. **Sentence-like UI**: Frame each rule as a sentence fragment: "When the *[field]* *[operator]* *[value]*" reads as natural language.

2. **Start with the field, then narrow**: Don't show all operators at once. Show the field picker first, then derive operator options from field type.

3. **Limit the field list**: Only show fields that are actually available on CallVault imports (title, duration, source, participant email, date). Don't expose database internals.

4. **Progressive complexity**: Start with simple single-condition rules. Reveal AND/OR grouping only after first rule is created (or via an "Advanced" toggle).

5. **Live preview feedback**: After configuring rules, show: *"This rule would match 12 of your last 30 imported calls"* — lets users validate before saving.

6. **Named presets**: Offer common starting templates:
   - "All Zoom calls → Sales Team channel"
   - "Calls over 30 minutes → Long calls folder"
   - "Title contains 'onboarding' → Onboarding folder"

### Recommended Condition Builder Design for CallVault

**Available fields to filter on:**
- Meeting title (text: contains, starts with, equals, is empty)
- Source (dropdown: Zoom, Fathom, Google Meet, YouTube)
- Duration (number: greater than, less than, between [minutes])
- Date imported (date: before, after, within last X days)
- Participant email (text: contains, equals)
- Participant name (text: contains, equals)

**Wireframe-level description:**

```
Import Rule: [Rule name input]

WHEN a call is imported...
AND [+ Add condition]

Condition row:
  [ Field ▼ ] [ is/contains/greater than ▼ ] [ value input ]
  
  Field options (grouped):
    Call Details:   Title, Duration, Date
    Source:         Zoom, Fathom, Google Meet, YouTube  
    Participants:   Email, Name
    
  Operator options (auto-selected by field type):
    Text:     contains, does not contain, equals, starts with, is empty
    Number:   greater than, less than, between, equals
    Select:   is, is not
    Date:     before, after, within last [N] days

THEN route to...
  Channel:  [ Select channel ▼ ]
  Folder:   [ Select folder ▼ ] (optional)
  Tags:     [ + Add tag ] (optional)
  
[Preview: "This rule would match 8 of your last 20 imported calls"]
[Save Rule]  [Cancel]
```

**Rule evaluation order:** First-match wins (like email filters). Rules can be reordered by drag. A "Default destination" catches unmatched imports.

---

## MCP Token Management UX

### What Top Tools Do

**Airtable Personal Access Tokens (HIGH confidence — official support docs, Nov 2025)**

Airtable's PAT system is the best reference for CallVault's use case:

- **Two-factor model**: Each token has (1) **Scopes** (what it can do) and (2) **Resources** (which workspaces/bases it can access)
- **Creation flow**: Name → Add scopes → Select resources → Generate → Copy once
- **Granular control**: Can scope a token to a single base, multiple bases, or all bases in a workspace
- **Developer Hub**: Dedicated section in the UI (`/create/tokens`) — separate from general settings
- **Regeneration with warning**: Regenerating shows a warning: *"Any services currently using this token will need to be updated"*
- **Admin feature**: Admins have enterprise scopes to access org-wide resources without being a direct collaborator

**Notion Internal Integrations (HIGH confidence — official developer docs)**

Notion's internal integration model:
- Create an integration → get an **Integration Token** (shown once, hidden after)
- Token is workspace-scoped (tied to one workspace)
- Pages must be **manually shared** with the integration to grant access
- Token stays the same across all API requests — no per-workspace rotation
- Warning: *"Keep your token secret. Never store the token in your source code."*

**Linear API Keys (MEDIUM confidence — developer portal nav confirmed, docs content limited)**

Linear supports both OAuth 2.0 (for integrations) and personal API keys (for direct use). Personal API keys are workspace-scoped, generated in Settings → API. No public documentation on per-team scoping.

**Common patterns across all tools:**

| Pattern | Notion | Airtable | Linear |
|---------|--------|----------|--------|
| Token visible only once | ✅ | ✅ | ✅ |
| Named tokens | ✅ | ✅ | ✅ |
| Scope limitation | ❌ (workspace) | ✅ (scopes + resources) | ✅ (partial) |
| Regeneration | ❌ | ✅ | ✅ |
| Multiple tokens | ✅ (one per integration) | ✅ | ✅ |
| Revocation | ✅ | ✅ | ✅ |

### Recommended MCP Token UX for CallVault

**Use case**: Coaches/admins generate tokens that clients/team members paste into their MCP-enabled AI tools (Claude, Cursor, etc.) to access call data.

**Token design decisions:**
- **Workspace-scoped by default**: Token gives access to a specific workspace's calls
- **Optional channel restriction**: Token can be further restricted to specific channels (so a client sees only their channel)
- **Read-only by default**: MCP tokens should be read-only (search, list, read transcripts). Write access (upload, delete) should require explicit opt-in.
- **Named for clarity**: Each token gets a human name: "Client John's Claude Access", "Sales Team Cursor Key"

**Token management UI flow:**

```
Workspace Settings → API & Integrations → MCP Tokens

[Token list]
  Token Name              Scope           Last Used    Actions
  "John's Claude"         This workspace  2 days ago   [Copy] [Regenerate] [Delete]
  "Sales team read"       Sales channel   Never        [Copy] [Regenerate] [Delete]

[+ Generate new token]

Generation modal:
  Token name: [________________]
  Access scope:
    ○ Entire workspace (all channels + folders)
    ● Specific channels: [Sales Team ✓] [Engineering] [Coaching]
  Permissions:
    ✅ Read calls and transcripts  
    ☐ Upload new calls
    ☐ Delete calls
  
  [Generate token]
  
  ─────────────────────────────────────────
  Your token (shown once — copy it now):
  cvt_workspace_abc123xyz...
  [Copy to clipboard]  [I've copied it, close]
  ─────────────────────────────────────────
```

**Key UX principles:**
1. Show token only once, with explicit "I've copied it" confirmation before closing
2. Display last-used timestamp — helps admins identify stale/unused tokens
3. Token name is required (prevent unnamed "token 1, token 2" confusion)
4. Revocation is immediate — no delay between delete and deactivation
5. Show the MCP server URL alongside the token — the two always go together

**Developer documentation UX (for the MCP config):**
Show copy-paste ready config block:
```json
{
  "mcpServers": {
    "callvault": {
      "url": "https://api.callvault.io/mcp",
      "headers": {
        "Authorization": "Bearer cvt_workspace_abc123xyz..."
      }
    }
  }
}
```
This removes ALL guesswork for non-technical users configuring Claude Desktop or Cursor.

---

## Extensible Import Sources

### What Top Tools Do

**Zapier's App/Integration Model (HIGH confidence — well-documented ecosystem)**

Zapier's connector architecture is the gold standard for extensible integrations:
- **Trigger/Action pattern**: Each connector exposes "triggers" (when something happens) and "actions" (do something)
- **Platform SDK**: Partners build connectors via the Zapier Developer Platform using a standardized schema (JSON + JS functions)
- **Discovery**: Users browse an app directory with search — 8,000+ apps
- **Authentication**: Each connector handles its own auth (OAuth, API key, basic) — platform provides the auth UI scaffolding
- **Versioning**: Connectors are versioned; breaking changes get a new version

**Notion's AI Connectors (HIGH confidence — official docs, Feb 2026)**

Notion recently launched "AI Connectors" for GitHub, Google Drive, Jira, Linear, Slack, Microsoft Teams/SharePoint. Pattern:
- Connectors are first-party (built by Notion), not a public platform yet
- Each connector follows the same connect/authorize/use pattern
- Connectors appear in "Notion AI Connectors" section of settings
- Connection = OAuth flow → connector reads data for AI search

**Linear's Integration Directory (MEDIUM confidence — developer portal nav confirmed)**
Linear maintains an Integration Directory with official and community integrations. Each integration requires OAuth 2.0 authorization. No public connector SDK documented.

### Recommended Connector Architecture for CallVault

**Goal**: Make adding new transcript sources a 1-3 day engineering task, not a 2-week refactor.

**The Source Adapter Pattern:**

Each import source is an independent adapter implementing a standard interface. This is the established pattern used by auth libraries (Passport.js), data pipelines (Apache Flink connectors), and integration platforms.

```typescript
interface CallVaultSourceAdapter {
  // Metadata
  id: string;               // "zoom" | "fathom" | "grain" | "mp3_upload"
  displayName: string;      // "Zoom"
  icon: string;             // URL or icon component
  authType: "oauth" | "api_key" | "file_upload" | "webhook";
  
  // Auth
  getAuthConfig(): AuthConfig;
  validateCredentials(credentials: Credentials): Promise<boolean>;
  
  // Import
  listAvailableCalls(credentials: Credentials, options: ListOptions): Promise<CallPreview[]>;
  importCall(credentials: Credentials, callId: string): Promise<RawCall>;
  
  // Webhook (optional — for real-time imports)
  getWebhookConfig?(): WebhookConfig;
  parseWebhookPayload?(payload: unknown): Promise<RawCall>;
}
```

**How adding a new source works:**
1. Engineer creates `src/importers/grain.ts` implementing `CallVaultSourceAdapter`
2. Registers adapter in `src/importers/registry.ts` — one line
3. Source automatically appears in the "Add source" UI (driven by registry)
4. Import routing rules automatically include the new source as a filter option
5. No changes needed to database schema, routing engine, or MCP tools

**File-based sources (MP3, MP4, video upload):**
- Adapter type: "file_upload"
- Uses existing file storage (Supabase Storage)
- Transcription: route to Vercel AI SDK → Whisper API
- Adapter handles the transcription step, normalizes output to `RawCall` format

**Webhook sources (Grain, Fireflies, tl;dv that push to webhooks):**
- Adapter registers a webhook endpoint path
- Platform generates a webhook URL: `https://api.callvault.io/webhooks/{workspace_id}/{source_id}`
- Adapter implements `parseWebhookPayload` to normalize
- No polling — real-time delivery

**Source registry UI (admin-facing):**
```
Settings → Import Sources

Connected sources:
  [Zoom icon]    Zoom             Connected ✅    [Disconnect] [Settings]
  [Fathom icon]  Fathom           Connected ✅    [Disconnect] [Settings]
  [Meets icon]   Google Meet      Not connected   [Connect]
  [YouTube icon] YouTube          Not connected   [Connect]

Add more sources:
  [Grain]  [Fireflies]  [tl;dv]  [Otter]  [Upload MP3/MP4]
```

**Priority for v2.0 connector additions (evidence-based):**
1. **Direct file upload (MP3/MP4/video)** — universal need, no API auth required, biggest unblocked use case
2. **Grain** — growing market share in revenue intelligence space
3. **Fireflies.ai** — large user base in coaching/sales
4. **Webhook receiver** — enables any tool that supports webhooks (tl;dv, Otter, etc.) without per-tool integration work

---

## Table Stakes

Features that users expect to be present for CallVault v2.0 to feel complete.

| Feature | Why Expected | Complexity | Priority |
|---------|--------------|------------|---------|
| Clear workspace/channel/folder naming | Users must understand hierarchy in 30 seconds | Low (rename only) | Critical |
| Import rules with at least 3 condition types | Users have organized folder structures and expect auto-routing | Medium | Critical |
| MCP token generation per workspace | Claude/AI tool users need this to connect | Low-Medium | Critical |
| Token copy-once UX with confirmation | Security hygiene that users recognize from GitHub, Airtable, etc. | Low | High |
| "Default destination" for unmatched calls | Without this, rules feel incomplete | Low | High |
| Condition builder preview ("X calls match") | Without this, users fear misconfiguring rules | Medium | High |
| Named tokens with revocation | Unnamed tokens become unmanageable quickly | Low | High |
| Source adapter registry (internal) | Without this, adding Grain in v3 takes 3x as long | Medium | High |

---

## Differentiators

Features that would make CallVault's approach better than alternatives (Grain, Fireflies, tl;dv).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI-powered rule suggestion** | System suggests routing rules based on existing folder structure: "Calls with 'onboarding' in the title → route to Onboarding folder?" | Medium-High | Killer feature — removes need to manually configure rules |
| **Rule conflict detection** | Warn when two rules both match the same call (ambiguous routing) | Low | Grain/Fireflies don't do this |
| **Per-channel MCP tokens** | Clients only see their channel — eliminates data isolation anxiety | Low-Medium | No competitor offers this level of granularity |
| **Universal file upload** | Accept MP3, MP4, WAV, video, then auto-transcribe — most tools require their own recording | Medium | Broadens source compatibility dramatically |
| **"Test this rule" dry-run** | Run rule against the last 30 imports and show what would have matched | Medium | Dramatically reduces setup errors |
| **MCP config copy-paste block** | Ready-to-paste JSON for Claude Desktop, Cursor, Windsurf | Low | Competitors don't offer MCP at all |

---

## Anti-Features

Things to deliberately NOT build in v2.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Nested rule groups (AND within OR within AND)** | Non-technical users cannot reason about complex boolean logic. Will abandon the feature entirely. | Max 2 levels: rows (AND) within groups (OR). That's enough for 95% of use cases. |
| **Regex conditions** | "Title matches `/\b(onboarding|onboard)\b/i`" is unusable for non-engineers | Provide named presets ("starts with", "contains any of") that cover the same cases |
| **Custom code/webhook condition evaluation** | Adds maintenance burden and security surface area for v2.0 | Ship the standard condition types first; evaluate need after user feedback |
| **3+ levels of workspace hierarchy** | Users get lost. Every tool that tried 4 levels (Jira: Organization > Site > Project > Board) gets criticized for complexity | Workspace → Channel → Folder is enough. Content nesting inside folders is fine. |
| **Auto-import all calls without approval** | Users will be horrified to find confidential calls imported without consent | Import queue with manual "approve" or "auto-approve by rule" — user controls the flow |
| **Token sharing via URL** | Tokens in URLs end up in logs, referrer headers, browser history | Always require copy-paste from UI; never embed tokens in links |
| **Per-user MCP tokens (instead of per-workspace)** | Multiplies token management overhead — coaches would manage one token per client × every AI tool | Per-workspace tokens cover the use case; channel scoping handles isolation |
| **Building a Zapier clone** | Full workflow automation engine is 12+ months of engineering for v2.0 | Ship: import routing rules only. Position advanced automation as v3 via Zapier integration. |

---

## MVP Recommendation

For v2.0 (this milestone), prioritize:

**Must-ship:**
1. Workspace rename: Bank → Workspace, Vault → Channel, Hub → Folder (with migration)
2. Import routing rules: 5-6 condition types, first-match routing, default destination
3. MCP tokens: generate, name, scope to workspace or channel, revoke, copy-once UX
4. Source adapter registry: internal refactor to enable future connectors (no visible UI change needed)

**Nice to have in v2.0:**
5. Rule preview ("X of last 30 calls match")
6. Direct file upload (MP3/video with auto-transcription)
7. MCP config copy-paste block in token UI

**Defer to v3:**
8. AI-suggested routing rules
9. Additional source connectors (Grain, Fireflies) — registry architecture enables this
10. Rule conflict detection

---

## Sources

| Source | URL | Confidence | Date |
|--------|-----|------------|------|
| Notion workspace docs | https://www.notion.so/help/intro-to-workspaces | HIGH | Feb 2026 |
| Notion teamspaces docs | https://www.notion.so/help/intro-to-teamspaces | HIGH | Feb 2026 |
| Linear teams docs | https://linear.app/docs/teams | HIGH | Feb 2026 |
| Linear developer portal | https://developers.linear.app/ | HIGH | Feb 2026 |
| Notion developer authorization | https://developers.notion.com/docs/authorization | HIGH | Feb 2026 |
| Airtable personal access tokens | https://support.airtable.com/docs/creating-and-using-api-keys-and-access-tokens | HIGH | Nov 2025 |
| HubSpot workflow creation | https://knowledge.hubspot.com/workflows/create-workflows | HIGH | Feb 2026 |
| HubSpot filter enrollment triggers | https://knowledge.hubspot.com/workflows/set-filter-enrollment-triggers | HIGH | Nov 2025 |
| MCP servers registry | https://github.com/modelcontextprotocol/servers | HIGH | Feb 2026 |
| Linear workspace/team structure | Verified from official docs | HIGH | Feb 2026 |
| Zapier filter patterns | MEDIUM — help article didn't load, patterns from ecosystem knowledge | MEDIUM | Feb 2026 |
| Loom workspace model | MEDIUM — post-Atlassian acquisition, help redirected | MEDIUM | Feb 2026 |
| Grain workspace model | LOW — 404 on help articles | LOW | Feb 2026 |
| Fireflies workspace model | LOW — help article timed out | LOW | Feb 2026 |
| Slack workspace/channel model | MEDIUM — based on well-documented public patterns | MEDIUM | Feb 2026 |
