# Codebase Concerns

**Analysis Date:** 2026-05-26

## Tech Debt

**Supabase Generated Types / Service Bypasses:**
- Issue: Service files such as `src/services/personal-folders.service.ts`, `src/services/personal-tags.service.ts`, and `src/services/organization-invitations.service.ts` query the database using the `untypedFrom` helper from `src/types/db-extensions.ts` instead of directly calling typed queries via `supabase.from()`.
- Why: They were originally built before `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, and `organization_invitations` tables were synchronized to the generated `src/types/supabase.ts` schema file.
- Impact: Development friction and bypasses type safety for queries, requiring manual `as PersonalFolder` type casting.
- Fix approach: Update the calls in those service files to use the native typed `supabase.from()` syntax, then delete unnecessary `untypedFrom` usages and clean up `src/types/db-extensions.ts`.

**Duplicate MCP Tool Categories Definition:**
- Issue: MCP tool categorization and descriptions are declared twice—canonically in the Deno backend folder (`supabase/functions/_shared/mcp-tool-categories.ts`) and as a duplicated mirror in the React frontend library (`src/lib/mcp-tool-categories.ts`).
- Why: Frontend and backend share categorization logic but are in separate environments (Vite/React vs Deno Edge Functions). A manual sync approach was chosen instead of setting up a build/sync script or code sharing.
- Impact: Maintenance overhead when adding or editing tools; risk of drift leading to discrepancies where the UI displays incorrect states or permissions.
- Fix approach: Establish a build script to automatically generate or copy the frontend mirror file from the canonical backend file, or consolidate them using a shared monorepo workspace if Vite/Deno allows.

**Obsolete Deduplication Code:**
- Issue: The file `supabase/functions/_shared/deduplication.ts` contains legacy, older synchronous deduplication logic that is no longer imported by any active edge function.
- Why: It was replaced by the asynchronous `dedup-fingerprint.ts` implementation (which uses `crypto.subtle` hashing).
- Impact: Developer confusion about the active deduplication logic and potential code bloat.
- Fix approach: Confirm no active imports remain and delete `supabase/functions/_shared/deduplication.ts`.

## Known Bugs

**Unmigrated `personal_folders` Table & Stub Implementations:**
- Symptoms: React service layer (`src/services/personal-folders.service.ts`) has hardcoded stubs returning empty arrays `[]` and empty objects `{}`.
- Trigger: Users attempting to fetch personal folders or folder assignments in the UI.
- Workaround: The UI falls back to showing no folders or folder assignments.
- Root cause: The React service methods (`getPersonalFolders` and `getPersonalFolderAssignments`) are still stubbed with `TODO` comments, waiting for full deployment/integration.
- Blocked by: Integration testing/UI wiring phase.

## Security Considerations

**Missing `organization_id` scoping in `tag_preferences`:**
- Risk: The `tag_preferences` table scopes preferences solely by `user_id` and does not have an `organization_id` column. When auto-tagging calls, organization context is lost for user preferences. Auto-tagging results could be inconsistent across members of the same organization analyzing the same calls.
- Current mitigation: Scoped to user_id.
- Recommendations: Create a database migration to add `organization_id` to `tag_preferences` and update RLS policies and `getUserTagPreferences` to filter by organization.

## Performance Bottlenecks

**Database Connection Constraints under heavy RAG/AI traffic:**
- Problem: External API clients or Edge Functions performing parallel operations (like AI-based summary extraction or auto-tagging) can quickly saturate Supabase database connections.
- Measurement: Occasional connection timeout or pool exhaustion errors under peak RAG/AI processing workloads.
- Cause: High connection counts from serverless edge functions when concurrency spikes.
- Improvement path: Ensure all external database clients strictly use PgBouncer connection pooling, and verify edge functions release connections early by optimizing queries.

**MCP Search Transcript Coverage Lack:**
- Problem: The MCP `search_calls` tool performs `title` and `summary` searches for organization scope via parallel `ilike` filters, but does not search the `full_transcript` column.
- Measurement: Degraded search relevance or failed lookups when queries match transcript content but not titles/summaries.
- Cause: Query structure in `mcp-server/index.ts` is limited to searching title and summary to maintain performance and avoid slow searches.
- Improvement path: Update query to run full-text search against the transcript, or add transcript indexing if `ILIKE` searches become too slow.

## Fragile Areas

**Deployment without Docker:**
- Why fragile: Because Docker is not running in the dev environment, standard `supabase functions deploy` commands hang.
- Common failures: Developers executing standard deploy commands experience hung terminals and aborted deployment processes.
- Safe modification: Deploy edge functions using the `--use-api` flag: `supabase functions deploy [FUNCTION_NAME] --use-api`.
- Test coverage: Not applicable (deployment tooling).

## Scaling Limits

**Supabase/PostgREST global_search Array Scans:**
- Current capacity: Efficient for current user databases with low-to-medium recording counts.
- Limit: ~10,000+ recordings per user before Aggregated Arrays start hitting performance bounds.
- Symptoms at limit: Latency spikes on `global_search` RPC in the UI.
- Scaling path: Replace aggregate PL/pgSQL array aggregates (`accessible_recording_ids`) with CTEs or temporary tables to allow index-based scans.

## Dependencies at Risk

**@tremor/react package:**
- Risk: Tremor v3 is deprecated and unmaintained, posing React 19 compatibility risks.
- Impact: Charts or dashboards break if upgrading dependencies.
- Migration plan: Migrate to modern alternatives (like Tremor Raw or standard Tailwind components with Recharts/recharts).

## Missing Critical Features

**Payment failure handling:**
- Problem: No retry mechanism or user notification when Polar subscription payment fails.
- Current workaround: Users manually re-enter payment info if they notice their access has degraded.
- Blocks: Customer retention and automated dunning workflows.
- Implementation complexity: Medium (handling Polar webhooks + automated email triggers + UI banner alerts).

## Test Coverage Gaps

**useBulkApplyRules TanStack Query hook test:**
- What's not tested: Assertions verifying toast notifications and mutation transitions.
- Risk: Code changes could break bulk-apply mutations without failing CI, leading to silent failures in the UI.
- Priority: Medium
- Difficulty to test: Requires refactoring test timers to use testing-library's async `waitFor` blocks instead of direct assertions.

**SidebarNav component rendering test:**
- What's not tested: Correct rendering of items and active states.
- Risk: Breaking navigation layout, active states, or router/auth integration.
- Priority: Medium
- Difficulty to test: Needs test suite rewrite to correctly mock routing paths and user profile context according to the current React API.

**useSharedCall edge function mock test:**
- What's not tested: Full shared call fetching logic in `useSharing.test.ts`.
- Risk: Silent regressions in sharing logic, access codes, or public call views.
- Priority: High
- Difficulty to test: Needs mocking global `fetch()` instead of `supabase.from()` calls, as it now calls the `share-call` Edge Function.

---

*Concerns audit: 2026-05-26*
*Update as issues are fixed or new ones discovered*
