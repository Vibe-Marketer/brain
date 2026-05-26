# CallVault Technical Concerns & Recommendations

**Analysis Date:** 2026-05-26  
**Scope:** Technical debt, type safety, unused code, unmigrated schemas, database constraints, testing gaps.

---

## Executive Summary

**Overall Health: GOOD with notable concerns**

CallVault's transition to a single-repo structure and unified source connectors is largely complete, and the MCP infrastructure is functional. However, there are significant gaps in compile-time type safety due to out-of-sync generated types, stubbed service logic for unmigrated tables, code duplication, and flaky unit tests. Addressing these issues will prevent development friction and regression risks.

**Priority Matrix:**

| Priority | Concern | Impact | Effort |
|----------|---------|--------|--------|
| 🔴 HIGH | Supabase generated types out-of-sync | Type Safety | Low |
| 🔴 HIGH | Unmigrated `personal_folders` table and stub service methods | Maintainability | Medium |
| 🟡 MEDIUM | Duplicated/drifted MCP tool categories definition | Maintainability | Low |
| 🟡 MEDIUM | Obsolete `deduplication.ts` utility file in shared functions | Code Quality | Low |
| 🟡 MEDIUM | Missing `organization_id` column in `tag_preferences` | Scoping | Medium |
| 🟢 LOW | MCP search tool lacks transcript content coverage | UX/Search | Low |
| 🟢 LOW | Flaky and outdated frontend hook/UI test assertions | Test Quality | Medium |

---

## 1. High Priority Concerns

### 1.1 Out-of-Sync Generated Types (🚨 CRITICAL DEVELOPER FRICTION)

**Problem:**
Database changes from recent development phases (such as the `call_notes` table and cache columns on `recordings`) have not been successfully synchronized to `src/types/supabase.ts`. Developers are forced to use type-casting workarounds.

**Impact:**
- Bypassed type safety via `as McpToken` and empty-array casts in multiple source files.
- High risk of runtime crashes if database column names or types diverge.
- Compile errors when type definitions are regenerated.

**Files Affected:**
- `src/types/supabase.ts`
- `src/services/mcp-tokens.service.ts`
- `src/services/mcp-token-capabilities.service.ts`
- `src/hooks/useMcpTokens.ts`

**Recommended Fix:**
Execute type regeneration from the Supabase CLI:
```bash
supabase gen types typescript --linked > src/types/supabase.ts
```
Then, refactor the casts in the affected services to consume the native generated interfaces.

**Estimated Impact:**
- Restore robust compile-time validation for all database-access queries and hooks.

---

### 1.2 Unmigrated `personal_folders` Table & Stub Implementations

**Problem:**
The database tables `personal_folders` and `personal_folder_recordings` do not exist in the database, requiring the service file to return hardcoded arrays/objects.

**Impact:**
- Broken or incomplete UI flows where users try to access or assign personal folders.
- Use of `untypedFrom` query bypasses that hide database structure mismatches.

**Files Affected:**
- `src/services/personal-folders.service.ts` (lines 20-23, 70-73)

**Recommended Fix:**
Write a database migration file `supabase/migrations/[TIMESTAMP]_create_personal_folders.sql` to instantiate:
- `personal_folders` table (id, user_id, organization_id, name, created_at, updated_at).
- `personal_folder_recordings` table (folder_id, recording_id, user_id, created_at).
Enable RLS on both tables and write appropriate security policies. Remove stubs in `src/services/personal-folders.service.ts`.

**Estimated Impact:**
- Restores the personal folders feature safely and replaces bypasses with typed queries.

---

## 2. Medium Priority Concerns

### 2.1 Duplication and Drift in MCP Tool Categories

**Problem:**
MCP tool categorization is declared twice: canonically in the Deno backend folder and as a duplicate mirror in the React frontend library.

**Impact:**
- Maintenance overhead: developers must update mappings in two places when adding or modifying tools.
- Risk of permission discrepancies where UI elements display incorrect states relative to actual Deno function constraints.

**Files Affected:**
- `supabase/functions/_shared/mcp-tool-categories.ts`
- `src/lib/mcp-tool-categories.ts`
- `src/lib/__tests__/mcp-tool-categories.test.ts` (line 225)

**Recommended Fix:**
Establish a single source of truth. Create a build script or modify Vite configurations to automatically generate `src/lib/mcp-tool-categories.ts` from `supabase/functions/_shared/mcp-tool-categories.ts` before compiling.

**Estimated Impact:**
- Prevents drift and guarantees frontend permission UI remains in lockstep with backend enforcement.

---

### 2.2 Obsolete Shared Code (Deduplication Sync Helper)

**Problem:**
The file `supabase/functions/_shared/deduplication.ts` contains legacy sync-matching code that is no longer imported by any active Edge Function. It has been replaced by the async `dedup-fingerprint.ts` implementation.

**Impact:**
- Developer confusion over which file contains the correct/active matching logic.
- Potential code bloat.

**Files Affected:**
- `supabase/functions/_shared/deduplication.ts`

**Recommended Fix:**
Remove `supabase/functions/_shared/deduplication.ts` from the codebase entirely after verifying all callers use `dedup-fingerprint.ts`.

**Estimated Impact:**
- Simplified file structure and clarity on the active deduplication strategy.

---

### 2.3 Missing `organization_id` Scoping in `tag_preferences`

**Problem:**
The `tag_preferences` table lacks an `organization_id` column and is scoped solely by `user_id`. When auto-tagging, organization context is lost for user preferences.

**Impact:**
- Organizations cannot share tag preferences across workspace members.
- Auto-tagging output remains inconsistent between different users analyzing identical calls within the same organization.

**Files Affected:**
- `supabase/functions/auto-tag-calls/index.ts` (lines 82-85)

**Recommended Fix:**
Create a database migration to add `organization_id` to the `tag_preferences` table. Update RLS policies and adjust `getUserTagPreferences` to filter results by the request's organization scope.

**Estimated Impact:**
- True organization-scoped tag preferences.

---

## 3. Low Priority Concerns

### 3.1 MCP Search Lacks Transcript Content Coverage

**Problem:**
The MCP `search_calls` tool only searches call titles and summaries under organization scope. Unlike the frontend search bar, it does not inspect the `full_transcript` column.

**Impact:**
- Degraded search quality when queried through the MCP server. Users must manually list and inspect transcripts.

**Files Affected:**
- `supabase/functions/mcp-server/index.ts` (lines 953-1003)

**Recommended Fix:**
Update the SQL query in `search_calls` to include an `ILIKE` condition on `full_transcript`.

**Estimated Impact:**
- Parity between frontend and MCP search behavior.

---

### 3.2 Flaky and Outdated Unit Tests

**Problem:**
Several test suites have known timing issues, mock mismatches, or missing routing contexts.

**Impact:**
- Flaky tests lead to false-positive CI pipeline failures.
- Developers skip or ignore tests rather than maintaining them.

**Files Affected:**
- `src/hooks/__tests__/useBulkApplyRules.test.ts` (line 37)
- `src/components/ui/__tests__/sidebar-nav.test.tsx` (line 49)
- `src/hooks/__tests__/useSharing.test.ts` (line 325)

**Recommended Fix:**
- Refactor toast/timeout assertions in `useBulkApplyRules.test.ts` using async `waitFor` blocks.
- Align mocks in `sidebar-nav.test.tsx` and `useSharing.test.ts` with the latest layout structure and edge function invocations.

**Estimated Impact:**
- 100% test reliability on every CI run.

---

## 4. Scalability and Operational Analysis

### 4.1 Deployment without Docker
Because Docker is not running in the development environment, standard `supabase functions deploy` commands hang. The `--use-api` flag must always be passed to bundle edge functions server-side:
```bash
supabase functions deploy [FUNCTION_NAME] --use-api
```
This is documented in `supabase/CLAUDE.md` and enforced in CI workflows.

### 4.2 Database Connection Constraints
Under heavy RAG, AI, or webhook traffic, Supabase database connections can quickly saturate. Connection pooling via PgBouncer must be strictly utilized by external clients, and edge functions should release connections early by resolving queries efficiently.

---

## 5. Action Items

### Immediate (Next 1-2 Sprints)
- [ ] **Regenerate Supabase Types:** Run CLI script to sync types and remove manual casts from service hooks.
  - File: `src/types/supabase.ts`
- [ ] **Consolidate MCP categories:** Implement a script to prevent backend-frontend mirror drift.
  - Files: `src/lib/mcp-tool-categories.ts`, `supabase/functions/_shared/mcp-tool-categories.ts`
- [ ] **Remove legacy deduplication utility:** Delete obsolete deduplication script.
  - File: `supabase/functions/_shared/deduplication.ts`

### Short-Term (1 Month)
- [ ] **Migrate `personal_folders` tables:** Deploy schemas and activate folder services.
  - File: `src/services/personal-folders.service.ts`
- [ ] **Add `organization_id` to tag preferences:** Enable organization-wide auto-tagging options.
  - File: `supabase/functions/auto-tag-calls/index.ts`
- [ ] **Fix flaky tests:** Resolve Vitest suite timing issues.
  - Files: `src/hooks/__tests__/useBulkApplyRules.test.ts`, `src/components/ui/__tests__/sidebar-nav.test.tsx`

### Medium-Term (3 Months)
- [ ] **Extend MCP search:** Update MCP queries to match the frontend full-transcript search logic.
  - File: `supabase/functions/mcp-server/index.ts`
