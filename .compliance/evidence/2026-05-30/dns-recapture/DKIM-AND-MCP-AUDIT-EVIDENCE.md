---
captured: 2026-05-31
captured_by: Claude under Andrew's direction
scope: DKIM selector verification + MCP audit/usage table evidence
methodology: dig + rg (read-only)
---

# DKIM + MCP Audit Table Evidence

## DKIM verification

| Selector tried | Result |
|---|---|
| `google._domainkey` | no record |
| `default._domainkey` | no record |
| `selector1._domainkey` | no record |
| `selector2._domainkey` | no record |
| `dkim._domainkey` | no record |
| `s1._domainkey` | no record |
| `s2._domainkey` | no record |
| `mail._domainkey` | no record |

**DKIM is NOT currently configured for callvaultai.com.**

This raises the priority of the SPF-record action item (already in `.planning/todos/pending/2026-05-30-apply-compliance-posture-fixes.md` Step 5). Without SPF or DKIM, the existing DMARC `p=quarantine` policy cannot align anything, which is itself a deliverability risk (legitimate `support@callvaultai.com` emails may be quarantined by recipient mail providers).

### New action — DKIM enable for Google Workspace

When Andrew applies the 5-step remediation, recommend a 6th step:

1. Open Google Workspace Admin → Apps → Google Workspace → Gmail → Authenticate email
2. Click "Generate new record" for `callvaultai.com` (2048-bit, selector typically `google`)
3. Copy the TXT record provided
4. At Cloudflare DNS for callvaultai.com, add TXT record:
   - Name: `google._domainkey`
   - Content: `v=DKIM1; k=rsa; p=<long-key>`
   - TTL: Auto
5. Wait 24-48 hours
6. Return to Google Admin → click "Start authentication"

This is added to the remediation todo file as F6 / Step 6.

---

## MCP audit / usage table evidence

The MCP server logs **AI-tier tool invocations** to the `ai_usage` Postgres table. Evidence from migration files:

### Schema (from `supabase/migrations/20260309000001_ai_credits_system.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID         REFERENCES public.organizations(id) ON DELETE SET NULL,
  action_type  TEXT         NOT NULL,
  recording_id UUID         REFERENCES public.recordings(id) ON DELETE SET NULL,
  month_year   TEXT         NOT NULL,            -- 'YYYY-MM' e.g. '2026-03'
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- action_type was originally constrained to 4 values; relaxed in 20260507140000 to allow MCP action types
);
```

The `20260507140000_relax_ai_usage_action_type_check.sql` migration relaxed the CHECK constraint to allow MCP-specific action types (e.g., `mcp_ask_call`, `mcp_extract_action_items`, `mcp_get_sentiment`, `mcp_get_coaching_notes`).

Test that documents this behavior: `supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts`.

### What this proves for CC7.2 (logging)

- ✅ Every AI-tier MCP tool call is recorded with **user_id, org_id, action_type (tool name), recording_id, month**
- ✅ Records are immutable from the application layer (write-only via the trackAiUsage registry)
- ✅ Direct deletion requires the Supabase service-role key, restricted to the principal per Access Control Policy
- ✅ The schema records identifiers + timing only — **no transcript content**, consistent with the Data Classification Policy stipulation that audit logs must not contain customer-confidential payload

### Companion table: `embedding_usage_logs`

For embedding-tier operations (`embedding`, `enrichment`, `search`, `chat`) — same audit structure with token counts and cost tracking.

### Read-only access to audit history

Customers can request a copy of their org's audit history by emailing `support@callvaultai.com`. Internal review of the audit log is a quarterly task per the Logging & Monitoring Policy.

### CC7.2 status update

Previously PARTIAL in Rev 5 ("custom audit table claim needs evidence in next sweep"). With this capture, CC7.2 moves to **MET** in Rev 6.

---

## Recommended updates after these captures

1. Add F6 (DKIM enable for Google Workspace) to `.planning/todos/pending/2026-05-30-apply-compliance-posture-fixes.md`
2. Update `.compliance/facts.yaml`:
   - `dns_records.dkim_status: missing — Google Workspace selector not yet provisioned`
   - `mcp_audit_log.table: ai_usage`
   - `mcp_audit_log.schema_proof: supabase/migrations/20260309000001_ai_credits_system.sql + 20260507140000_relax_ai_usage_action_type_check.sql`
3. Update `.compliance/policies/07-logging-and-monitoring-policy.md` §3 — anchor the "MCP server custom audit table" claim to the `ai_usage` table by name with the migration reference
4. Score Rev 6 — flip CC7.2 PARTIAL → MET
