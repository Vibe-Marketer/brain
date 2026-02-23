# Pitfalls Research: CallVault v2.0 Strategic Pivot

**Research Date:** February 22, 2026
**Context:** Brownfield repo split — new frontend, same Supabase backend, feature removal, workspace redesign, data migration, MCP expansion
**Overall Confidence:** HIGH (verified against official Supabase docs, Fowler/Spolsky canonical sources, verified patterns)

---

## The "Big Rewrite" Trap

The single most documented failure mode in software engineering (Spolsky 2000, Fowler 2024). The CallVault v2.0 pivot is NOT a full rewrite — the backend is preserved — but the new-frontend-repo framing carries the same psychological gravity. Teams routinely underestimate it.

### Pitfall 1: Scope Creep Behind The "Clean Slate" Fantasy

**What goes wrong:** The moment a new repo is created, every developer becomes an architect. "While we're at it, let's also..." becomes the most dangerous sentence. The 89K-line removal quickly expands into 89K lines removed + 40K new lines redesigned + 15K lines refactored "for the right way."

**Why it happens:** New repos feel like permission to fix everything that was annoying. There's no regression history to anchor you — only blank files and optimism.

**Consequences:**
- Timeline triples. A 4-week "new frontend" becomes a 12-week product halt.
- The old repo keeps getting user-reported bugs while the new repo isn't ready. You're now maintaining two products.
- Users experience a frozen, degrading product and churn before v2 ships.

**Warning signs:**
- PRs touching areas not in the migration spec
- "We should rethink how we handle X while we're here"
- Sprint velocity dropping while lines-added-to-new-repo accelerates
- No working demo of the new frontend after week 1

**Prevention:**
- Write a strict **feature cut line**: the new repo ships exactly the features in the spec, zero more. Additions are post-v2.
- Establish a Strangler Fig model (Fowler): old repo stays alive and serves users until every page has a verified replacement. No big-bang cutover.
- Define phase completion by WORKING DEMO of that phase in staging, not by lines written.
- Create a "parking lot" doc for good ideas discovered during the pivot. They get addressed in v2.1.

**Phase:** Phase 1 (Repo Setup). Must be locked in the first week.

---

### Pitfall 2: The "We'll Add Tests Later" Death March

**What goes wrong:** New repo launches with zero tests because "we're moving fast." The first bug in production requires reading the same old spaghetti that motivated the new repo in the first place. Now you're debugging a system with no tests and no history.

**Why it happens:** Tests feel slow when you're behind schedule. New-repo enthusiasm prioritizes shipping over verifying.

**Consequences:**
- First production bug takes 3x longer to fix than it would have in the old repo
- Regression rate increases with each feature added
- Confidence collapses; team reverts to treating the new repo with the same fear as the old one

**Warning signs:**
- "We'll add coverage after launch" in PR reviews
- No CI test gate on the new repo from day 1

**Prevention:**
- Require test coverage for every page/feature before it's considered "done" in the new repo
- Set up CI on day 1 — no merges without passing tests

**Phase:** Phase 1 (Repo Setup). Non-negotiable infrastructure.

---

### Pitfall 3: Running Two Products Without a Migration Timeline

**What goes wrong:** The old repo continues serving users indefinitely while the new repo "isn't quite ready." No hard migration date is set. The team operates two codebases in parallel. Features requested by users get applied to the old repo (because "users need it now") but never ported to the new one.

**Why it happens:** Nobody wants to be the one to force users onto an unfinished product. The deadline for cutover keeps slipping.

**Consequences:**
- Old repo feature work feeds the old repo's complexity — the exact problem the pivot was meant to escape
- The new repo falls behind on features that users now expect
- Team spends double the cognitive overhead context-switching between repos

**Warning signs:**
- More than 2 weeks of parallel maintenance without a hard cutover date
- Feature requests being addressed in the OLD repo after the new repo exists

**Prevention:**
- Set a hard cutover date on day 1: "Old repo goes read-only on [date]. New repo is the only one receiving features."
- Run old and new in parallel ONLY for auth/data continuity, never for feature development
- Keep the old repo in maintenance-only mode the moment the new repo launches to any user

**Phase:** Phase 1 (Repo Setup) — cutover date; Phase 2 (Core Migration) — maintenance-mode trigger.

---

## OAuth & Auth Migration Pitfalls

This is the highest-probability outage during a repo split. Supabase Auth is backend-managed, but OAuth redirect URIs and Site URL are per-frontend-domain.

### Pitfall 4: Missing New Domain in Supabase Redirect URL Allowlist

**What goes wrong:** The new frontend deploys to a new domain (e.g., `app-v2.callvault.ai`). A user clicks "Login with Google." Auth completes on the Supabase backend. Supabase tries to redirect back to the allowed URL list — the new domain isn't there. Users get `ERR_REDIRECT` or a blank page. **Login is completely broken.**

**Why it happens:** Supabase Auth Redirect URLs must be explicitly allowlisted in Authentication > URL Configuration. This is not automatic. The default Site URL (`https://old-domain.com`) still points to the old frontend. The new domain is unlisted.

**Verified from:** Supabase official docs (`/docs/guides/auth/redirect-urls`): *"The Site URL in URL Configuration defines the default redirect URL when no redirectTo is specified. Change this from `http://localhost:3000` to your production URL."* Wildcard patterns like `https://*-team.vercel.app/**` must be explicitly added for preview deploys.

**Consequences:**
- ALL social login (Google, GitHub, etc.) broken on new frontend
- Magic link emails redirect to wrong domain
- Password reset emails go to old domain

**Warning signs:**
- First login attempt on new domain returns "OAuth redirect mismatch" error
- Magic links from Supabase email templates use `{{ .SiteURL }}` not `{{ .RedirectTo }}`

**Prevention:**
1. Before the new repo's first deploy, add the new domain to Supabase Auth > URL Configuration
2. During dual-operation, add BOTH old and new domains to the allowlist
3. If using Vercel preview URLs, add `https://*-<your-team>.vercel.app/**` wildcard
4. Update email templates: replace `{{ .SiteURL }}` with `{{ .RedirectTo }}` in confirm/reset emails
5. Update `SITE_URL` env var only when cutting over fully — not before

**Phase:** Phase 1 (Repo Setup). Must complete before any user touches the new frontend.

---

### Pitfall 5: Third-Party OAuth App Still Pointing to Old Callback URL

**What goes wrong:** Google OAuth app, GitHub OAuth app, Zoom OAuth app all have `Authorization callback URL` hardcoded to `https://old-domain.supabase.co/auth/v1/callback`. This actually doesn't break immediately because the callback goes to Supabase (backend-side), not your frontend. BUT if you're running a custom OAuth flow or have any OAuth apps pointing directly at your frontend domain, those break.

**Why it happens:** Supabase social auth callback is at `https://<project-ref>.supabase.co/auth/v1/callback` — this doesn't change with frontend domain. However, teams often confuse this with their app's redirect URL.

**The actual risk for CallVault:** If Fathom, Zoom, or any other integration uses your frontend domain in their OAuth app registration as a return URL, that breaks on domain change.

**Prevention:**
- Audit all third-party OAuth app registrations before the cutover
- Identify which apps use `<project-ref>.supabase.co/auth/v1/callback` (safe — doesn't change) vs. `your-app-domain.com/callback` (must update)
- For integrations like Zoom/Fathom that redirect to YOUR frontend after OAuth: update their OAuth app callback URL to the new domain

**Phase:** Phase 1 (Repo Setup). Audit list required before first deploy.

---

### Pitfall 6: Supabase Site URL Updated Too Early (Breaking Old Frontend)

**What goes wrong:** Someone updates `SITE_URL` in Supabase Auth to the new domain before users are migrated. All existing sessions on the old frontend now redirect to the new domain on token refresh. Users who haven't been notified are dropped into the new (potentially incomplete) frontend.

**Why it happens:** Eagerness to "make the new domain official." SITE_URL controls where passwordless logins and session refreshes go.

**Prevention:**
- Keep SITE_URL pointing to old domain until the cutover date
- Only update SITE_URL as part of the explicit cutover step, with a user communication plan in place
- During dual-operation, use the Redirect URL allowlist (not SITE_URL) to enable the new domain

**Phase:** Phase 2 (Core Migration) cutover step. Treat as a production deployment action.

---

## User Data Migration Pitfalls

The fathom_calls → recordings migration touches real user data. These pitfalls are irreversible if not caught in testing.

### Pitfall 7: Migrating Without a Dry-Run on Production Data Shape

**What goes wrong:** The migration script is written and tested against dev data. It runs fine. Then it runs against production fathom_calls and discovers: NULL fields you assumed were populated, encoding edge cases, rows with orphaned foreign keys, or fathom_calls records that share recording_ids across multiple users (data model assumptions that weren't true).

**Why it happens:** Dev data is clean. Production data is 18 months of human usage, API glitches, and half-completed imports.

**Consequences:**
- Migration fails mid-run, leaving recordings table in partial state
- Orphaned data — fathom_calls rows with no corresponding recordings entry
- Data visible to wrong user (catastrophic if RLS gap exists during migration)

**Warning signs:**
- Migration script written without COUNT(*) queries on real production data first
- No assertion checks on field nullability before the script runs
- No rollback plan documented before running

**Prevention:**
1. **Before writing the migration script:** Run profiling queries against production (read-only):
   ```sql
   SELECT COUNT(*) FROM fathom_calls WHERE recording_url IS NULL;
   SELECT COUNT(*) FROM fathom_calls WHERE user_id IS NULL;
   SELECT COUNT(*) FROM fathom_calls GROUP BY user_id ORDER BY count DESC LIMIT 20;
   ```
2. Write the migration as a **dry-run first** (`SELECT ... INTO TEMP TABLE`) before the real `INSERT INTO recordings`
3. Verify row counts match before and after
4. Keep fathom_calls table intact (don't DROP) until recordings table is verified by real users

**Phase:** Phase 3 (Data Migration). Dry-run must precede any production execution.

---

### Pitfall 8: RLS Gap During Migration Window

**What goes wrong:** During the migration, there's a window where both `fathom_calls` (old) and `recordings` (new) tables exist. The new frontend queries `recordings`. If an RLS policy on `recordings` isn't verified before any user is switched to the new frontend, a user could query another user's recordings.

**Why it happens:** New tables created via migration scripts don't automatically inherit RLS policies. Unlike tables created in the Supabase dashboard (which enable RLS by default), raw SQL migrations require `ALTER TABLE recordings ENABLE ROW LEVEL SECURITY` plus explicit policies.

**Verified from:** Supabase RLS docs: *"RLS is enabled by default on tables created with the Table Editor. If you create one in raw SQL or with the SQL editor, remember to enable RLS yourself."*

**Consequences:** Data leak between users. Catastrophic for a B2B SaaS with paying users.

**Warning signs:**
- Migration SQL script doesn't include `ENABLE ROW LEVEL SECURITY` statement
- No test asserting a user cannot SELECT another user's recordings
- New table tested only with service_role key (which bypasses RLS)

**Prevention:**
1. The migration SQL must include:
   ```sql
   ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users see own recordings" ON recordings
     FOR SELECT TO authenticated
     USING ((select auth.uid()) = user_id);
   ```
2. Test RLS before any frontend switch: log in as User A, attempt to query User B's recording_id. Must return empty.
3. Never test migrations using the service_role key — always use an authenticated user JWT.

**Phase:** Phase 3 (Data Migration). RLS must be verified before phase is marked complete.

---

### Pitfall 9: Trigger/Index Overhead During Migration Causing Timeout

**What goes wrong:** The `fathom_calls` table has triggers (e.g., for embedding generation, webhooks) or indexes that fire during the `INSERT INTO recordings SELECT FROM fathom_calls` migration. Migration times out or triggers fire on historical data unexpectedly.

**Verified from:** Supabase import docs: *"When importing large datasets, it's often beneficial to disable triggers temporarily. Triggers can significantly slow down the import process, especially if they involve complex logic."*

**Prevention:**
1. Before migration: `ALTER TABLE recordings DISABLE TRIGGER ALL;`
2. Run migration
3. After verification: `ALTER TABLE recordings ENABLE TRIGGER ALL;`
4. Rebuild indexes separately after data load: `CREATE INDEX CONCURRENTLY ...`

**Phase:** Phase 3 (Data Migration). Pre-migration checklist item.

---

### Pitfall 10: Premature DROP of fathom_calls

**What goes wrong:** fathom_calls is dropped after the migration completes. Then a user reports that their call from 3 months ago is missing. Investigation reveals a data class the migration script didn't handle (e.g., calls without a workspace_id that pre-date the workspace model). The data is gone.

**Why it happens:** "Migration complete" means the script ran without error, not that every row was correctly migrated.

**Prevention:**
- Do NOT drop fathom_calls during the v2.0 milestone. Rename it `fathom_calls_archived_v1` and archive.
- Only drop after 30 days of production operation with zero data-related support tickets.
- Run a reconciliation query before considering it safe:
  ```sql
  -- Should return 0 rows
  SELECT id FROM fathom_calls
  WHERE NOT EXISTS (
    SELECT 1 FROM recordings WHERE recordings.source_id = fathom_calls.id
  );
  ```

**Phase:** Phase 3 (Data Migration) — archive, not drop. Post-launch (30-day window) — final cleanup.

---

## Workspace Renaming Pitfalls

Renaming "Bank/Vault" to a new organizational model after users have built muscle memory is a UX landmine.

### Pitfall 11: Rename Without Redirect Strategy for Deep Links

**What goes wrong:** Users have bookmarked `app.callvault.ai/bank/abc123/vault/xyz` or have shared links. After the rename, those URLs 404. Beta users who come back after a week find their bookmarks broken and assume the product is broken.

**Why it happens:** URL structure changes when the entity name changes. Teams treat it as a "simple rename" without mapping old URL patterns to new ones.

**Warning signs:**
- No URL migration plan in the spec
- Old route patterns deleted without redirect rules added

**Prevention:**
- Before any rename: audit all URL patterns that include the old entity names
- Add redirect rules: `GET /bank/:bankId/vault/:vaultId` → `GET /workspace/:workspaceId` (resolving via database mapping)
- Keep old routes active for 90 days with 301 redirects, log redirect hits to measure usage
- Email/notification to active beta users: "Your bookmarks will auto-redirect. Here's what changed."

**Phase:** Phase 2 (Core Migration — Workspace Redesign). Routing must be shipped before any user sees the rename.

---

### Pitfall 12: Partial Rename — Half the UI Uses Old Names

**What goes wrong:** The new name is applied to nav, settings, and marketing copy. But API error messages, email notifications, Supabase table column names, and support documentation still say "Bank" and "Vault." Users get confused when an error says "Vault not found" but the UI shows "Workspace."

**Why it happens:** Rename is done top-down (visible UI first) without auditing all surfaces.

**Warning signs:**
- API error responses not updated
- Email templates still use old terminology
- In-app tooltips or empty states use old names

**Prevention:**
- Create a rename audit checklist BEFORE starting:
  - [ ] URL routes
  - [ ] UI labels
  - [ ] API error messages and response keys (public-facing)
  - [ ] Email templates
  - [ ] In-app onboarding copy
  - [ ] Support documentation
  - [ ] Console/debug logs (LOW priority, but flag any that leak to users)
- Use grep/search across all repos for "bank" and "vault" (case-insensitive) before marking rename complete

**Phase:** Phase 2 (Workspace Redesign). Audit checklist is deliverable, not just a task.

---

### Pitfall 13: Existing User Data References Breaking on Rename

**What goes wrong:** If `bank_id` or `vault_id` columns are renamed in the database schema, any code paths that weren't updated break silently (returning null or failing FK constraints). This includes Edge Functions, RLS policies, and any external integrations that reference old column names.

**Why it happens:** Database column renames have blast radius across all query code, including code in different repos.

**Prevention:**
- Use a two-step approach: Add NEW columns, migrate data, then deprecate old columns. Do NOT rename in-place.
- Keep `bank_id` column alongside new `workspace_id` column during transition; old RLS policies continue to work
- Run a grep across ALL code (frontend, Edge Functions, supabase migrations) before removing old column references

**Phase:** Phase 2 (Workspace Redesign). Database migration is additive, not destructive.

---

## Import Rules UX Pitfalls

Condition builders are notoriously difficult to get right for non-technical users. This is a known failure mode in SaaS products.

### Pitfall 14: Operator Overload — Too Many Conditions at Once

**What goes wrong:** The condition builder ships with 8+ operators (contains, starts with, ends with, equals, not equals, regex, is empty, matches...). Non-technical users open it, freeze, and click away. They use the default routing instead of setting up rules.

**Why it happens:** Engineers build for completeness. Users need guidance.

**Consequences:**
- Feature adoption is near-zero despite significant engineering investment
- Support tickets: "How do I make calls from Zoom go to my Sales workspace?"
- Users who can't figure it out churn or route everything manually

**Warning signs:**
- Beta testers can't complete rule setup without help
- The condition builder has more than 5 operator options in v1

**Prevention:**
- Ship v1 with maximum 3-4 operators: `contains`, `equals`, `starts with`, `doesn't contain`
- Lead with examples: show pre-built templates ("Route Zoom calls to Sales team")
- Use natural language labels: "Call title contains" not "field: call.title, operator: CONTAINS"
- Validate with beta user before shipping: can a non-technical user set up a rule in under 2 minutes?

**Phase:** Phase 4 (Import Rules). UX prototype must be user-tested before engineering builds the full system.

---

### Pitfall 15: Rule Conflict — No Conflict Detection or Priority System

**What goes wrong:** User creates Rule A: "Route calls with 'Sales' in title to Sales workspace." Then creates Rule B: "Route all calls to General workspace." Both rules match the same call. Which wins? If priority isn't defined and surfaced, the result is non-deterministic or always-last-wins behavior that confuses users.

**Why it happens:** Rule systems are built around adding rules; conflict resolution is added as an afterthought.

**Consequences:**
- Users set up rules that don't work the way they expect
- Support burden: "My rule isn't working"
- Users distrust the routing system entirely

**Prevention:**
- Define priority order in the data model from day 1: `rules.priority` column (integer, lower = higher priority)
- Surface rule priority in the UI: numbered list, drag-to-reorder
- Add real-time conflict warning: "This rule overlaps with Rule #2. Rule #1 will take priority."
- Default to "first match wins" — simpler to reason about than "most specific wins"

**Phase:** Phase 4 (Import Rules). Priority model must be in the schema from first migration.

---

### Pitfall 16: No "Rule Preview" — Users Can't Test Before Activating

**What goes wrong:** Users create a rule and activate it. Their next 10 calls go to the wrong workspace. They don't realize for 3 days. Historical data isn't retroactively re-routed.

**Why it happens:** Condition builder ships without a "test this rule against recent calls" feature.

**Consequences:**
- User data in wrong workspace, manual cleanup required
- Trust broken: "The routing system can't be relied on"

**Prevention:**
- Ship a "Preview" mode: before saving a rule, show "This rule would match X of your last 20 calls"
- Apply rules only to future calls on activation, not retroactively — make this explicit in the UI
- Log all routing decisions with the rule that triggered them, so users can audit

**Phase:** Phase 4 (Import Rules). Preview is a required feature, not a nice-to-have.

---

## MCP Auth Scoping Pitfalls

Expanding from user-scoped to workspace-scoped MCP tokens introduces a new authorization surface.

### Pitfall 17: OAuth Scopes Don't Control Database Access — RLS Does

**What goes wrong:** The team adds a `workspace_id` scope to the MCP OAuth flow ("this token is for workspace X"). The backend then trusts this scope claim directly. But Supabase RLS doesn't automatically understand custom scopes — it operates on `auth.uid()` and `auth.jwt()` claims. The scope claim in the token isn't enforced at the database level unless RLS policies explicitly check it.

**Verified from:** Supabase Token Security docs: *"The OAuth scopes (openid, email, profile, phone) control what user information is included in ID tokens... They do NOT control access to your database tables or API endpoints. Use RLS to define which OAuth clients can access which data."*

**Consequences:**
- A token scoped to Workspace A can query Workspace B's recordings if RLS doesn't check workspace_id
- Token scope enforcement exists only at the application layer — bypassable if someone hits the database directly

**Prevention:**
1. RLS policies on workspace-scoped tables must check BOTH `auth.uid()` AND workspace membership:
   ```sql
   CREATE POLICY "MCP clients access workspace data"
   ON recordings FOR SELECT
   USING (
     auth.uid() = user_id AND
     workspace_id IN (
       SELECT workspace_id FROM workspace_members
       WHERE user_id = (SELECT auth.uid())
     )
   );
   ```
2. Use `client_id` claim in JWT to differentiate MCP access from direct user access:
   ```sql
   -- MCP clients get read-only, direct users get full access
   CREATE POLICY "MCP read-only"
   ON recordings FOR SELECT
   USING (
     auth.uid() = user_id AND
     (auth.jwt() ->> 'client_id') IS NOT NULL -- MCP token
   );
   ```
3. NEVER test MCP auth with service_role key — always use the actual OAuth token

**Phase:** Phase 5 (MCP Expansion). RLS audit required before any workspace-scoped token is issued.

---

### Pitfall 18: Token Issued for Wrong Workspace — No Workspace Binding in Token

**What goes wrong:** User authenticates MCP client for "Sales" workspace. The token is issued but contains only `user_id`, not `workspace_id`. The MCP client sends `workspace_id` in the request body. The Edge Function trusts the request body workspace_id without verifying it matches what was authorized. User A's MCP client can send `workspace_id=B` and access Workspace B's data if they're a member of B.

**Why it happens:** workspace_id as a request parameter (not a token claim) is a common shortcut. It seems fine until someone sends the wrong workspace_id.

**Prevention:**
- Store the authorized workspace_id in the token itself, not in the request body
- Use Supabase's Custom Access Token Hook to inject `workspace_id` into the JWT at issuance:
  ```typescript
  // In custom-access-token hook
  if (client_id?.startsWith('mcp-')) {
    const workspace = await getWorkspaceForClient(client_id, user.id);
    customClaims.workspace_id = workspace.id;
  }
  ```
- Edge Function extracts workspace_id from `auth.jwt()`, not from request body

**Phase:** Phase 5 (MCP Expansion). Token design must be finalized before any MCP client ships to users.

---

### Pitfall 19: Dynamic Client Registration — Open Registration Allows Malicious Clients

**What goes wrong:** Dynamic client registration is enabled for MCP clients (convenient for onboarding). A bad actor registers a client with a redirect_uri pointing to their server. They trick a user into authorizing it. They capture the code, exchange for tokens, access the user's workspace data.

**Verified from:** Supabase MCP docs: *"Dynamic registration allows any MCP client to register with your project. Consider requiring user approval for all clients, monitoring registered clients regularly, validating redirect URIs are from trusted domains."*

**Prevention:**
- If using dynamic registration: enforce redirect URI domain allowlist (only trusted MCP client domains)
- Require explicit user approval screen before token issuance (show client name, permissions requested)
- Audit `auth.oauth_clients` table weekly for unexpected registrations
- For v2.0: consider starting with pre-registered clients only (no dynamic registration) until you have monitoring in place

**Phase:** Phase 5 (MCP Expansion). Security review required before enabling dynamic registration.

---

### Pitfall 20: Existing User-Scoped MCP Tokens Not Revoked on Workspace Switch

**What goes wrong:** A user has an active MCP token for Workspace A. They leave the workspace. The token was issued with `workspace_id=A` in its claim. If the token hasn't expired, it still provides access to Workspace A's data — even after the user has been removed from the workspace.

**Why it happens:** JWT tokens are stateless. Revoking access means invalidating the session, not just changing membership records. Supabase RLS must be written to CHECK CURRENT membership at query time, not rely on token-time claims.

**Prevention:**
- RLS policies must join against CURRENT workspace membership, not against the `workspace_id` in the JWT claim:
  ```sql
  -- DO THIS: check current membership
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid())
      AND status = 'active'  -- check current status
    )
  )
  
  -- NOT THIS: trust the token claim (stale after membership change)
  USING (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
  )
  ```
- When a user is removed from a workspace, revoke their active sessions for that workspace in `auth.sessions`

**Phase:** Phase 5 (MCP Expansion). Must be addressed in initial RLS design.

---

## Phase-by-Phase Risk Map

| Phase | Pitfall | Severity | Must Address By |
|-------|---------|----------|-----------------|
| **P1: New Repo Setup** | Scope creep into clean-slate redesign (P1) | 🔴 CRITICAL | Day 1 — scope lock |
| **P1: New Repo Setup** | Missing new domain in Supabase redirect allowlist (P4) | 🔴 CRITICAL | Before first user deploy |
| **P1: New Repo Setup** | Third-party OAuth apps pointing to old domain (P5) | 🔴 HIGH | Before first user deploy |
| **P1: New Repo Setup** | No parallel maintenance cutover date (P3) | 🔴 HIGH | Week 1 |
| **P1: New Repo Setup** | No test coverage from day 1 (P2) | 🟡 MEDIUM | CI setup at repo creation |
| **P2: Workspace Redesign** | Rename without URL redirect strategy (P11) | 🔴 CRITICAL | Before any user sees rename |
| **P2: Workspace Redesign** | Partial rename leaving old names on non-UI surfaces (P12) | 🔴 HIGH | Audit checklist before dev |
| **P2: Workspace Redesign** | In-place database column rename breaking queries (P13) | 🔴 HIGH | Use additive migration only |
| **P2: Workspace Redesign** | SITE_URL updated too early (P6) | 🟡 MEDIUM | Tied to cutover date |
| **P3: Data Migration** | Migrating without dry-run on production data shape (P7) | 🔴 CRITICAL | Before any prod execution |
| **P3: Data Migration** | RLS gap during migration window (P8) | 🔴 CRITICAL | Verified before any frontend switch |
| **P3: Data Migration** | Trigger/index overhead causing timeout (P9) | 🟡 MEDIUM | Pre-migration checklist |
| **P3: Data Migration** | Premature DROP of fathom_calls (P10) | 🔴 HIGH | Archive, don't drop — 30-day hold |
| **P4: Import Rules** | Operator overload confusing non-technical users (P14) | 🟡 MEDIUM | UX prototype + user test before build |
| **P4: Import Rules** | No rule priority system (P15) | 🟡 MEDIUM | Schema design in first migration |
| **P4: Import Rules** | No rule preview/test mode (P16) | 🟡 MEDIUM | Required feature, not optional |
| **P5: MCP Expansion** | OAuth scopes not enforcing DB access — RLS does (P17) | 🔴 CRITICAL | Before workspace-scoped tokens issued |
| **P5: MCP Expansion** | Workspace_id in request body, not token (P18) | 🔴 HIGH | Token design spec |
| **P5: MCP Expansion** | Dynamic registration security (P19) | 🟡 MEDIUM | Security review before enabling |
| **P5: MCP Expansion** | Stale tokens after workspace membership change (P20) | 🟡 MEDIUM | RLS design at phase start |

---

## Sources

| Source | Type | Confidence | How Used |
|--------|------|------------|---------|
| [Supabase Redirect URLs docs](https://supabase.com/docs/guides/auth/redirect-urls) | Official | HIGH | OAuth redirect URI pitfalls (P4, P5, P6) |
| [Supabase MCP Authentication docs](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) | Official | HIGH | MCP OAuth flow, dynamic registration risks (P17-P20) |
| [Supabase Token Security & RLS docs](https://supabase.com/docs/guides/auth/oauth-server/token-security) | Official | HIGH | Scope vs RLS distinction, client_id claim (P17, P18) |
| [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) | Official | HIGH | RLS gap during migration (P8), RLS performance |
| [Supabase Import Data docs](https://supabase.com/docs/guides/database/import-data) | Official | HIGH | Trigger disable during migration (P9) |
| [Joel Spolsky — Things You Should Never Do](https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/) | Canonical | HIGH | Big rewrite failure patterns (P1-P3) |
| [Martin Fowler — Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html) | Canonical | HIGH | Gradual migration model, transitional architecture (P1, P3) |
| CallVault existing codebase analysis (MIGRATION_ASSESSMENT.md) | Internal | HIGH | fathom_calls scope, current architecture constraints |
