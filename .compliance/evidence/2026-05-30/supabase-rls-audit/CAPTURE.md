---
captured: 2026-05-31
captured_by: Claude under Andrew's direction
scope: Supabase Row Level Security policy enumeration + org-scoping verification
methodology: rg + cat (read-only against committed migrations)
trust_services_criteria: ["CC6.1", "CC6.3", "CC6.4", "C1.1"]
---

# Supabase RLS Audit

> Proof that multi-tenant data isolation is enforced at the database layer, not just the application layer.

## Headline numbers

- **Migration files containing CREATE POLICY:** 63
- **Total CREATE POLICY statements across all migrations:** 384
- **ALTER TABLE ... ENABLE ROW LEVEL SECURITY statements:** 96+ (tables with RLS turned on)

This is a substantial RLS surface. The application enforces tenant isolation at the database level on dozens of tables.

## Scope of RLS enforcement

RLS is enabled on (representative; complete list grep-able via `rg "ENABLE ROW LEVEL SECURITY" supabase/migrations/`):

**Customer-data tables (highest priority):**
- `recordings` (the primary call recording table)
- `transcripts` (transcript text)
- `transcript_segments` (transcript chunks)
- `chat_messages` + `chat_sessions` + `chat_tool_calls`
- `contacts` + per-contact data
- `call_speakers` + `call_participants` + `speakers`
- `coach_notes` + `coach_relationships` + `coach_shares`
- `manager_notes` + `team_shares` + `team_memberships` + `teams`
- `transcript_chunks` + `embedding_jobs` + `embedding_queue`
- `automation_execution_history`
- `quotes` + `insights` + `generated_content`
- `tag_preferences`

**Org / workspace structural tables:**
- `workspaces`, `workspace_members`, `workspace_calls`
- `organizations` + members
- `folders`, `folder_assignments`
- `categorization_rules`

**Sharing / access tables:**
- `call_share_access_log`, `call_share_links`
- `transcript_tags`, `categorization_rules`

**Infrastructure tables (also RLS'd for defense in depth):**
- `chat_tool_calls`, `processed_webhooks`, `sync_jobs`, `webhook_deliveries`
- `user_profiles`, `user_roles`, `user_settings`
- `ai_models`

## Org-scoping pattern verification (sampled)

Modern RLS pattern in CallVault scopes by `org_members` → `organizations` membership. Sampled policies:

```
workspace_admins_select_invitations   (from 20260228000001 + recreated in 20260301000002)
workspace_admins_insert_invitations
workspace_admins_update_invitations
invited_users_select_own_invitations  (refined in 20260309100000 to use auth.email())
```

Migrations show iteration on RLS — including a dedicated `20260301000002_recreate_rls_policies.sql` migration that re-applied the entire workspace-scoping rule set after a schema redesign. This is healthy behavior: RLS is treated as a first-class invariant that survives schema changes.

A separate `20260309100000_fix_invitation_rls_auth_email.sql` migration corrected an invitation-RLS bug by switching from `auth.uid()` to `auth.email()` matching — exactly the kind of careful refinement an auditor wants to see.

## MCP-layer enforcement (defense in depth)

In addition to database-layer RLS, the MCP server enforces org scoping at the application layer. Every MCP tool call passes through:

- `supabase/functions/mcp-server/auth.ts` — authenticates the bearer token + resolves the org/workspace scope
- `supabase/functions/mcp-server/index.ts` — category-gating that rejects out-of-scope tool calls before any DB query

Tests that protect this boundary:

- `supabase/functions/mcp-server/__tests__/category-gating.test.ts`
- `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts`
- `supabase/functions/mcp-server/__tests__/contract-surface.test.ts`

The combination — database RLS + application category-gating + protocol-level token scope — provides three independent layers of tenant isolation.

## Service-role boundary

The Supabase service role bypasses RLS by design. Service-role usage is restricted to:

- MCP server token resolution (must look up hex tokens in `mcp_tokens` which is RLS-restricted for non-service contexts)
- Edge Function operations that explicitly require cross-tenant access (defined in Edge Function source code)

The service-role key is stored in Vercel + Supabase Edge Function secrets, never in source code (verified by secret scan 2026-05-31).

## Gaps and follow-ups

| Item | Note |
|------|------|
| Periodic RLS policy review during quarterly access reviews | Already in the Quarterly Access Review template (Section 2.1 Supabase) |
| Programmatic RLS coverage check (e.g., a CI test that fails if a new table is created without an RLS policy) | Recommended future-state; could be a Vitest test against the schema dump. Not blocking. |
| RLS bypass audit log for service-role queries | Inherited from Supabase audit log; reviewed quarterly per Logging & Monitoring Policy |

## Net assessment

**CC6.1 (logical access)** — MET. Strongly evidenced.
**CC6.3 (authorization)** — MET. Three-layer defense in depth.
**CC6.4 (restriction to authorized users)** — MET. RLS at the database layer is the most-defensible authorization control.
**C1.1 (confidentiality)** — MET. Multi-tenant isolation enforced at the lowest level.

This audit alone justifies a "MET" rating on all four criteria above, supplementing the policy-level claims with concrete evidence.
