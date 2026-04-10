---
phase: 19-provisioning-foundation
plan: "03"
subsystem: mcp-tokens
tags: [mcp, token-regeneration, settings, tanstack-query]
dependency_graph:
  requires: ["19-01"]
  provides: ["regenerateMcpToken service", "useRegenerateMcpToken hook", "MCPTab regenerate flow"]
  affects: ["src/services/mcp-tokens.service.ts", "src/hooks/useMcpTokens.ts", "src/components/settings/MCPTab.tsx"]
tech_stack:
  added: []
  patterns: ["supabase.rpc for atomic token swap", "TanStack mutation with onSuccess callback", "AlertDialog confirmation before destructive action"]
key_files:
  modified:
    - src/services/mcp-tokens.service.ts
    - src/hooks/useMcpTokens.ts
    - src/components/settings/MCPTab.tsx
decisions:
  - "TokenRevealDialog reused for regeneration without modification — same show-once pattern applies to both creation and regeneration"
  - "Regenerate button placed before Delete button in TokenRow — less destructive action visually precedes more destructive"
metrics:
  duration: "6m"
  completed: "2026-04-10T15:39:13Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 19 Plan 03: MCP Token Regeneration Summary

One-liner: Token regeneration flow with RPC-backed atomic swap, AlertDialog confirmation, and TokenRevealDialog reuse for new token display.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add regenerateMcpToken service and useRegenerateMcpToken hook | 54cdbe72 | src/services/mcp-tokens.service.ts, src/hooks/useMcpTokens.ts |
| 2 | Add Regenerate button, confirmation dialog, and reveal flow to MCPTab | 895449a4 | src/components/settings/MCPTab.tsx |

## What Was Built

**Service (`src/services/mcp-tokens.service.ts`):**
- `regenerateMcpToken(id)` calls `regenerate_mcp_token` RPC with `p_token_id`
- Handles `RETURNS TABLE` array response by taking first element
- Throws user-friendly error on null result (IDOR protection per T-19-09)

**Hook (`src/hooks/useMcpTokens.ts`):**
- `useRegenerateMcpToken(options?)` wraps the service in a TanStack mutation
- Accepts optional `onSuccess` callback for UI to display the new token
- Invalidates `MCP_TOKEN_KEYS.all` on success, shows success/error toasts

**Component (`src/components/settings/MCPTab.tsx`):**
- `RiRefreshLine` added to Remix Icons imports
- `TokenRow` extended with `onRegenerate` prop and Regenerate button (before Delete)
- `MCPTab` has `regenerateTarget` state and `handleRegenerateConfirm` handler
- Regenerate `AlertDialog` warns: "The current token...will immediately stop working"
- On success, `setNewlyCreatedToken(token)` reuses existing `TokenRevealDialog`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-19-09 | Service throws on null RPC result (IDOR protection) | Implemented |
| T-19-10 | Atomic UPDATE in RPC — zero window between revoke and issue | Implemented at DB layer (19-01) |
| T-19-11 | Token shown once in reveal dialog with store-securely warning | Accepted (same as creation) |

## Known Stubs

None — all data flows are wired.

## Threat Flags

None — no new network endpoints or auth paths introduced beyond the existing `regenerate_mcp_token` RPC already defined in 19-01.

## Self-Check: PASSED

- [x] src/services/mcp-tokens.service.ts — regenerateMcpToken function present
- [x] src/hooks/useMcpTokens.ts — useRegenerateMcpToken hook present
- [x] src/components/settings/MCPTab.tsx — RiRefreshLine, onRegenerate, regenerateTarget, AlertDialog present
- [x] Commit 54cdbe72 exists
- [x] Commit 895449a4 exists
