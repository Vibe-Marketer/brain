# Options Comparison: CallVault MCP + Vault/Bank Architecture

**Date:** 2026-02-21
**Status:** Strategic Decision
**Context:** MCP returns stale data (dashboard queries `fathom_calls`, MCP queries `vault_entries` + `recordings`). Need architecture that supports personal/business banks, client MCP access, and multi-tenant vault scoping.

---

## Strategic Summary

CallVault has two parallel data paths that diverged: the dashboard reads from `fathom_calls` (legacy, 100% of data), while the MCP reads from `vault_entries` + `recordings` (new schema, ~5% migrated). We need to unify the data path AND architect multi-tenant MCP access for clients. The recommended approach is **Option C: Unified Query Layer + Workspace-Aware MCP** -- a quick fix that reads from both tables now, combined with a workspace selection tool that positions CallVault for multi-tenant client access.

---

## Context

### The Immediate Problem
- **39 locations** in the frontend query `fathom_calls` directly
- **4 locations** query the new `recordings` + `vault_entries` schema
- The MCP exclusively uses the new schema, which has ~5% of data migrated
- Result: MCP can't see any calls after Feb 5 (last batch migration run)

### The Strategic Problem
- Clients need MCP access scoped to their vaults (not your personal data)
- Personal vs Business banks need different access boundaries
- The current MCP has no concept of "which workspace am I operating in"
- No production MCP server has solved multi-tenant workspace switching well yet

### Current Architecture
```
fathom_calls (legacy)          recordings + vault_entries (new)
  |                              |
  |-- 39 frontend hooks          |-- 4 frontend hooks
  |-- Dashboard "All Transcripts"|-- MCP (all operations)
  |-- PROFITS, contacts, tags    |-- Vault detail views
  |-- 100% of call data          |-- ~5% migrated data
```

---

## Decision Criteria

1. **Time to fix MCP data gap** - How fast can we get MCP seeing all calls? - Weight: **HIGH**
2. **Multi-tenant client access** - Can clients get vault-scoped MCP access? - Weight: **HIGH**
3. **Migration path clarity** - Does this move us toward one canonical schema? - Weight: **HIGH**
4. **Implementation complexity** - How much code changes? Risk of breaking existing features? - Weight: **MEDIUM**
5. **MCP spec alignment** - Does this follow emerging MCP patterns and conventions? - Weight: **MEDIUM**
6. **Data integrity** - Are we preserving all fields, avoiding data loss? - Weight: **MEDIUM**
7. **Operational simplicity** - How many moving parts? Can it break silently? - Weight: **LOW**

---

## Options

### Option A: MCP Queries fathom_calls Directly

Make the MCP query the same table the dashboard uses. Ignore the new schema for now.

**Changes:**
- Rewrite MCP `recordings.list`, `recordings.search`, `recordings.get` to query `fathom_calls`
- Add `user_id` filter (from JWT) to all queries
- Remove vault_entries dependency entirely from MCP
- Keep bank/vault navigation tools but they become decorative

**Evaluation:**
- Time to fix MCP data gap: **Excellent** - 1-2 days, direct table swap
- Multi-tenant client access: **Poor** - fathom_calls is user-scoped, no vault/bank boundary. Clients can't get scoped access.
- Migration path clarity: **Poor** - Moves backwards. Reinforces legacy dependency. Two schemas drift further apart.
- Implementation complexity: **Low** - Simple query rewrites
- MCP spec alignment: **Neutral** - Works, but no resource scoping
- Data integrity: **Good** - All fields available (fathom_calls has everything)
- Operational simplicity: **Good** - One table, simple queries

**Score: 4/10** -- Fixes the symptom, worsens the disease.

---

### Option B: Complete Migration Pipeline, Keep MCP on New Schema

Fix the sync pipeline so every Fathom import automatically creates `recordings` + `vault_entries` rows. Run a backfill for existing data.

**Changes:**
- Modify `sync-meetings` Edge Function to also INSERT into `recordings` + `vault_entries` (not just `fathom_calls`)
- Run `migrate_batch_fathom_calls()` to backfill all existing data
- Add a database trigger: `AFTER INSERT ON fathom_calls` -> auto-create `recordings` + `vault_entries`
- Keep MCP queries unchanged (they're already correct for the new schema)
- Gradually migrate dashboard hooks from `fathom_calls` to `vault_entries` + `recordings`

**Evaluation:**
- Time to fix MCP data gap: **Moderate** - 3-5 days (trigger + backfill + testing)
- Multi-tenant client access: **Good** - vault_entries + recordings architecture supports bank/vault scoping natively
- Migration path clarity: **Excellent** - Moves toward single canonical schema. Clear deprecation path for fathom_calls.
- Implementation complexity: **Medium** - Trigger logic, backfill, sync function changes. Risk: what if trigger fails silently?
- MCP spec alignment: **Good** - Resources scoped to vaults
- Data integrity: **Moderate** - Must ensure all 9 "partially migrated" fields in source_metadata are preserved. 5 fields currently lost in migration.
- Operational simplicity: **Moderate** - Two tables kept in sync via trigger. Can diverge if trigger fails.

**Score: 7/10** -- Right direction, but slow to unblock the MCP.

---

### Option C: Unified Query Layer + Workspace-Aware MCP (Recommended)

Two-phase approach: (1) Quick fix: MCP gets a unified query function that reads from BOTH tables with deduplication. (2) Architecture: Add `set_active_workspace` tool + vault-scoped access for clients.

**Phase 1 - Quick Fix (1-2 days):**
- Create a Supabase RPC function `get_unified_recordings(p_user_id, p_vault_id, p_limit, p_offset)` that:
  - Queries `vault_entries` + `recordings` for migrated data
  - UNION with `fathom_calls` for non-migrated data (where `recording_id NOT IN (SELECT legacy_recording_id FROM recordings)`)
  - Returns a unified result set with consistent columns
- MCP calls this RPC instead of raw vault_entries queries
- Dashboard continues working unchanged

**Phase 2 - Workspace-Aware MCP (1-2 weeks):**
- Add `navigation.set_active_workspace` tool (follows Cloudflare MCP's `set_active_account` pattern)
- Active workspace scopes all subsequent recording queries to that bank's vaults
- Add vault-scoped tokens for clients: JWT with `vault_id` claim limits access to specific vault(s)
- Resource URIs: `callvault://{bank_id}/vault/{vault_id}/recording/{recording_id}`

**Phase 3 - Migration Completion (ongoing):**
- Add trigger on `fathom_calls` INSERT to auto-create `recordings` + `vault_entries`
- Backfill remaining data
- Gradually swap dashboard hooks to new schema
- Deprecate unified query function when migration is 100%

**Evaluation:**
- Time to fix MCP data gap: **Excellent** - Phase 1 ships in 1-2 days
- Multi-tenant client access: **Excellent** - Phase 2 adds vault-scoped tokens + workspace selection
- Migration path clarity: **Good** - Unified query is a bridge, not a destination. Clear path to Phase 3.
- Implementation complexity: **Medium** - RPC function is moderate. Workspace tool follows existing patterns (Cloudflare MCP does this).
- MCP spec alignment: **Excellent** - Follows Cloudflare's `set_active_account` pattern, Slack's workspace scoping, and MCP resource URI conventions.
- Data integrity: **Excellent** - UNION query preserves all data from both tables. No field loss.
- Operational simplicity: **Moderate** - RPC adds a layer, but it's a single function to maintain.

**Score: 9/10** -- Fast fix + right architecture + clear migration path.

---

### Option D: Instance-Per-Tenant MCP (Silo Model)

Deploy separate MCP server instances for each bank/workspace. Each instance has its own credentials scoped to that bank.

**Changes:**
- Generate per-bank API keys or JWT tokens
- Users configure multiple MCP entries in their client (e.g., `callvault-personal`, `callvault-business`)
- Each instance only sees its own bank's data
- Client vault access: generate a vault-scoped token, client configures their own MCP instance

**Evaluation:**
- Time to fix MCP data gap: **Moderate** - Still need to fix the data pipeline regardless
- Multi-tenant client access: **Good** - Each client gets their own isolated instance
- Migration path clarity: **Neutral** - Orthogonal to the data schema problem
- Implementation complexity: **Low per instance** but **High operationally** - N instances to manage, configure, debug
- MCP spec alignment: **Good** - Linear, Slack, GitHub all use this pattern
- Data integrity: **Good** - Each instance queries its own scope
- Operational simplicity: **Poor** - Users must configure multiple MCP entries. Doesn't scale beyond 3-4 banks.

**Score: 5/10** -- Works for 2 banks, breaks at scale. Doesn't solve the data gap.

---

## Comparison Matrix

| Criterion | Weight | A: Query fathom_calls | B: Complete Migration | C: Unified + Workspace (Rec.) | D: Instance-Per-Tenant |
|---|---|---|---|---|---|
| Time to fix MCP data gap | HIGH | Excellent | Moderate | Excellent | Moderate |
| Multi-tenant client access | HIGH | Poor | Good | Excellent | Good |
| Migration path clarity | HIGH | Poor | Excellent | Good | Neutral |
| Implementation complexity | MED | Low | Medium | Medium | High (ops) |
| MCP spec alignment | MED | Neutral | Good | Excellent | Good |
| Data integrity | MED | Good | Moderate | Excellent | Good |
| Operational simplicity | LOW | Good | Moderate | Moderate | Poor |
| **Weighted Score** | | **4/10** | **7/10** | **9/10** | **5/10** |

---

## Recommendation

**Option C: Unified Query Layer + Workspace-Aware MCP**

This is the only option that simultaneously:
1. **Fixes the data gap in 1-2 days** (Phase 1 RPC function)
2. **Enables client vault-scoped MCP access** (Phase 2 workspace tools + scoped tokens)
3. **Doesn't lock you into legacy** (bridge pattern with clear deprecation path)
4. **Follows proven MCP patterns** (Cloudflare's `set_active_account`, Notion's OAuth scoping)

### Runner-up

**Option B: Complete Migration Pipeline** -- Choose this if you decide the unified query layer adds too much complexity and you're willing to wait 3-5 days for the MCP fix. This is the "purist" approach that skips the bridge layer.

**Switch cost from C to B:** Low. The unified RPC function in Option C is designed to be deprecated once migration is complete. You're building toward Option B regardless -- Option C just gives you a working MCP immediately.

---

## Implementation Context

### Chosen: Option C

#### Phase 1: Quick Fix (Ship in 1-2 days)

**1. Create unified RPC function:**

```sql
CREATE OR REPLACE FUNCTION get_unified_recordings(
  p_user_id UUID,
  p_vault_id UUID DEFAULT NULL,
  p_bank_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id TEXT,                    -- UUID for new, BIGINT::TEXT for legacy
  title TEXT,
  source_app TEXT,
  duration INTEGER,
  recording_start_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  global_tags TEXT[],
  summary TEXT,
  full_transcript TEXT,
  source TEXT,                -- 'new_schema' or 'legacy'
  vault_entry_id UUID,
  local_tags TEXT[],
  folder_id UUID,
  legacy_recording_id BIGINT
) AS $$
BEGIN
  RETURN QUERY
  -- New schema recordings (migrated)
  SELECT
    r.id::TEXT,
    r.title,
    r.source_app,
    r.duration,
    r.recording_start_time,
    r.created_at,
    r.global_tags,
    r.summary,
    r.full_transcript,
    'new_schema'::TEXT AS source,
    ve.id AS vault_entry_id,
    ve.local_tags,
    ve.folder_id,
    r.legacy_recording_id
  FROM vault_entries ve
  JOIN recordings r ON ve.recording_id = r.id
  WHERE (p_vault_id IS NULL OR ve.vault_id = p_vault_id)
    AND (p_bank_id IS NULL OR r.bank_id = p_bank_id)
    AND is_bank_member(r.bank_id, p_user_id)

  UNION ALL

  -- Legacy fathom_calls (not yet migrated)
  SELECT
    fc.recording_id::TEXT,
    fc.title,
    COALESCE(fc.source_platform, 'fathom'),
    NULL::INTEGER,
    fc.recording_start_time,
    fc.created_at,
    COALESCE(fc.auto_tags, '{}'),
    fc.summary,
    fc.full_transcript,
    'legacy'::TEXT AS source,
    NULL::UUID,
    NULL::TEXT[],
    NULL::UUID,
    fc.recording_id
  FROM fathom_calls fc
  WHERE fc.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.legacy_recording_id = fc.recording_id
        AND r.owner_user_id = p_user_id
    )

  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

**2. Update MCP handlers to call the RPC:**
- `recordings.list` -> calls `get_unified_recordings(userId, vaultId)`
- `recordings.search` -> calls same RPC with additional client-side filtering
- `recordings.get` -> keep existing dual-read pattern (already works)

**3. Update MCP transcript handlers:**
- Already have dual-read (recordings -> fathom_calls fallback) -- no changes needed

#### Phase 2: Workspace-Aware MCP (1-2 weeks)

**1. Add `navigation.set_active_workspace` tool:**
```typescript
// New handler: set active bank context for session
// Follows Cloudflare MCP's set_active_account pattern
HANDLERS["navigation.set_active_workspace"] = async (params, context) => {
  // Validate user is member of this bank
  // Store active_bank_id in session/request context
  // All subsequent recording queries scope to this bank
};
```

**2. Add vault-scoped JWT tokens for clients:**
- New Edge Function: `generate-vault-token`
- Creates JWT with claims: `{ sub: client_user_id, vault_ids: ["vault-uuid-1"], bank_id: "bank-uuid" }`
- RLS policies respect these claims
- Client configures MCP with this scoped token

**3. Resource URI scheme:**
```
callvault://banks/{bank_id}/vaults/{vault_id}/recordings/{recording_id}
callvault://banks/{bank_id}/vaults/{vault_id}/recordings/{recording_id}/transcript
```

#### Phase 3: Migration Completion (Ongoing, parallel)

**1. Auto-migration trigger on fathom_calls INSERT:**
```sql
CREATE OR REPLACE FUNCTION auto_migrate_fathom_call()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM migrate_fathom_call_to_recording(NEW.user_id, NEW.recording_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_migrate_fathom_call
  AFTER INSERT ON fathom_calls
  FOR EACH ROW
  EXECUTE FUNCTION auto_migrate_fathom_call();
```

**2. Backfill remaining data:**
- Run `migrate_batch_fathom_calls()` in batches of 100
- Monitor with `get_migration_progress()`

**3. Swap dashboard hooks (gradual):**
- Priority order: TranscriptsTab.tsx (main list), useCallDetailQueries (detail view), usePROFITS, useContacts
- Each hook gets a `useUnifiedRecordings` replacement
- Feature flag to A/B test

**4. Deprecate unified RPC when migration hits 100%:**
- Replace `get_unified_recordings` with direct vault_entries + recordings queries
- Remove fathom_calls UNION branch

### Runner-up: Option B

- **When it's better:** If you decide the RPC function adds unnecessary complexity and you'd rather just fix the pipeline properly. Choose this if you're OK with 3-5 days before MCP works.
- **Switch cost:** Low. Option C is designed to converge to Option B. The RPC function is the only extra piece, and it's explicitly temporary.

### Integration Notes

- **Existing code impact:** Phase 1 changes only the MCP handler layer (~3 files in callvault-mcp). Zero dashboard changes.
- **Gotchas:** The UNION query needs careful deduplication -- `NOT EXISTS` subquery prevents double-counting migrated records. Performance depends on `legacy_recording_id` index (already exists).
- **Testing:** Compare RPC output against dashboard's fathom_calls query for same user. Should return identical titles/dates.

---

## External Reference Patterns

| Pattern | Used By | Relevance to CallVault |
|---|---|---|
| `set_active_account` tool | Cloudflare MCP | Direct model for workspace switching |
| Instance-per-workspace | Linear, Slack, GitHub | Fallback if workspace tool proves insufficient |
| OAuth with workspace claims | Notion (hosted MCP) | Model for client vault-scoped tokens |
| Dual-auth (tenant + user) | SageMCP | Pattern for business bank shared access |
| Dynamic tool descriptions | Ragie FastMCP | Nice-to-have for vault-contextual tools |
| Path-based tenant routing | MCP Plexus | Alternative to JWT claims for tenant isolation |

---

## Sources

- [MCP Authorization Specification (draft)](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Resources Specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [Notion Hosted MCP Server - Inside Look](https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look)
- [Cloudflare MCP (set_active_account pattern)](https://github.com/cloudflare/mcp-server-cloudflare)
- [Solo.io - MCP Authorization Patterns](https://www.solo.io/blog/mcp-authorization-patterns-for-upstream-api-calls)
- [SageMCP multi-tenant platform](https://github.com/sagemcp/sagemcp)
- [MCP Plexus tenant isolation](https://github.com/Super-I-Tech/mcp_plexus)
- [AWS Multi-Tenant MCP Sample](https://github.com/aws-samples/sample-multi-tenant-saas-mcp-server)
- [Aaron Parecki - MCP Auth Spec Update](https://aaronparecki.com/2025/11/25/1/mcp-authorization-spec-update)
- CallVault codebase analysis (39 fathom_calls references, 4 recordings references, 28 MCP operations)
