# Phase 19: Provisioning Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 19-provisioning-foundation
**Mode:** auto
**Areas discussed:** Auto-provisioning trigger, Server-side plan gating, Token regeneration, Downgrade behavior

---

## Auto-provisioning trigger

| Option | Description | Selected |
|--------|-------------|----------|
| DB trigger on org creation | Postgres trigger auto-creates org-scoped mcp_token when org is created with PRO+ plan | ✓ |
| Application-level hook | Frontend or edge function creates token after org creation completes | |
| Lazy provisioning | Token created on first MCP settings page visit | |

**User's choice:** DB trigger on org creation (auto-selected, recommended default)
**Notes:** Also handles upgrade path — on plan upgrade to PRO+, auto-create if no token exists. Uses org owner as token user_id.

---

## Server-side plan gating

| Option | Description | Selected |
|--------|-------------|----------|
| Query billing on every call | Edge function checks org subscription status before each tool invocation | ✓ |
| Cache plan tier on token | Store plan_tier column on mcp_tokens, update on billing webhook | |
| Middleware approach | Separate plan-check function called before mcp-server | |

**User's choice:** Query billing on every call (auto-selected, recommended default)
**Notes:** Most reliable — no stale cache risk. One additional query per MCP call but acceptable given MCP call frequency. Returns clear JSON-RPC error with upgrade URL for free tier.

---

## Token regeneration

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic UPDATE in-place | Single SQL UPDATE replaces token value, preserves all other fields | ✓ |
| Delete + create new | Delete old token, create new one | |
| Soft-revoke + new | Mark old as revoked, create new token | |

**User's choice:** Atomic UPDATE in-place (auto-selected, recommended default)
**Notes:** Simplest approach. Old token immediately invalid. New token shown once in reveal dialog. Preserves name, scope, org/workspace assignment. No need for revocation history in v2.1.

---

## Downgrade behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep tokens, reject at runtime | Tokens stay in DB, plan gating blocks all calls for free-tier orgs | ✓ |
| Soft-delete tokens on downgrade | Mark tokens as disabled, reactivate on upgrade | |
| Hard-delete tokens on downgrade | Remove tokens from DB entirely on plan downgrade | |

**User's choice:** Keep tokens, reject at runtime (auto-selected, recommended default)
**Notes:** Least complex. No webhook needed to react to billing changes. Plan gating on every call (D-04/D-05) naturally handles this. Tokens reactivate instantly on re-upgrade.

---

## Claude's Discretion

- Exact timing of auto-provision trigger (synchronous vs async)
- Whether to cache plan_tier on mcp_tokens for performance
- Error message wording
- UI loading states for regeneration

## Deferred Ideas

None — analysis stayed within phase scope
