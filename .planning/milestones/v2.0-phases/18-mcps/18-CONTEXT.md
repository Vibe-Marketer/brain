# Phase 18: MCPs - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Each organization can issue one MCP server strictly scoped to org data, capable of reading calls and searching, with a working OAuth consent flow. MCP server and OAuth consent page already exist — this phase is E2E verification and gap-fixing.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — verification/gap-fix phase. Key known state:
- MCP OAuth consent page exists — needs E2E verification
- MCP server edge function exists at `supabase/functions/mcp-server/`
- Server must be scoped to organization data only
- One MCP server per organization

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/mcp-server/index.ts` — MCP server edge function
- MCP OAuth consent page (location TBD — check src/pages/)
- Settings MCP tab (`src/components/settings/MCPTab.tsx`)

### Integration Points
- MCP settings in Settings page for issuing/revoking server
- OAuth consent flow for MCP authorization
- Org-scoped data access (Phase 11 foundation)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — verification and gap-fix phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 18-mcps*
*Context gathered: 2026-03-30 via infrastructure skip*
