---
phase: 21-write-crud-tools
status: verified
verified_at: 2026-05-07T19:50:00Z
score: "TOOL-05 verified 11/11 PASS via 21-UAT (live MCP client). TOOL-06/07 partial — shipped pre-Phase-21 (commit ad73e50e), inventory-only."
source_evidence:
  - "21-01-SUMMARY.md"
  - "21-UAT.md"
  - "21-SHIPPED-INVENTORY.md (referenced by 21-01-SUMMARY)"
requirements_covered:
  - TOOL-05
  - TOOL-06
  - TOOL-07
---

# Phase 21 Verification (Backfilled 2026-05-07)

> Promoted from embedded evidence in 21-01-SUMMARY.md + 21-UAT.md per Phase 27 D-06.
> TOOL-05 has full UAT coverage (11/11 PASS via live MCP client). TOOL-06 and TOOL-07 shipped pre-Phase-21 (commit `ad73e50e`) and were backfilled to inventory only — no UAT performed.

## Goal

Users' MCP clients can organize calls by adding notes, tags, and moving calls to folders.

## Success Criteria Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | TOOL-05 create_note stores note + get_call_notes returns it | ✅ verified | 21-UAT.md tests 2-3, 9: live MCP create_note returned `Created note on "Q3 Sales Sync" (...)`; get_call_notes returned the note formatted per spec; 11/11 PASS |
| 2 | TOOL-06 tag_call applies tag, visible in transcript library | ⚠️ partial (inventory-only) | Shipped pre-Phase-21 at `mcp-server/index.ts:508` (commit ad73e50e); no UAT |
| 3 | TOOL-07 add_call_to_folder moves call, visible in folder hierarchy | ⚠️ partial (inventory-only) | Shipped pre-Phase-21 at `mcp-server/index.ts:447` (commit ad73e50e); no UAT |
| 4 | Write tools reject cross-org call IDs | ✅ verified (TOOL-05 only) | 21-UAT.md test 6: cross-workspace boundary enforced; create_note returned -32001 "Recording not found or not accessible"; subsequent get_call_notes confirmed insertion blocked |

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| TOOL-05 | ✅ verified (11/11 UAT PASS) | 21-UAT.md (live MCP client tests via Andrew + Claude) |
| TOOL-06 | ⚠️ partial (inventory-only, no UAT) | 21-SHIPPED-INVENTORY.md; tag_call live at `mcp-server/index.ts:508` |
| TOOL-07 | ⚠️ partial (inventory-only, no UAT) | 21-SHIPPED-INVENTORY.md; add_call_to_folder live at `mcp-server/index.ts:447` |

## Backfill Notes

- TOOL-05 (`create_note`) was the explicit Phase 21 deliverable — shipped 2026-05-07 via `21-01-PLAN.md` with new `call_notes` table (migration `20260507083233_call_notes.sql`), 5 RLS policies, and `get_call_notes` rewired to read from the new table.
- TOOL-06 (`tag_call`) and TOOL-07 (`add_call_to_folder`) were already live in production before Phase 21 was tracked in GSD — backfilled to `21-SHIPPED-INVENTORY.md` only.
- 21-UAT.md tests cover 11 scenarios for `create_note` + `get_call_notes`: cold-start smoke, live create, get_call_notes formatting, org-scoped + workspace-scoped tokens, cross-workspace boundary, empty content rejection, 10,000-char boundary, multi-note ordering, author label resolution (post-fix `6f9a11f3`: display name not email), legacy `workspace_entries.notes` column untouched.
- Bonus 16 write tools shipped beyond spec — see 21-SHIPPED-INVENTORY.md. 5 destructive bonus tools (`delete_call`, `move_calls_to_workspace`, `copy_calls_to_organization`, `create_organization`, `create_workspace`) flagged in audit tech_debt for future capability-gating before being advertised.

---

_Backfilled 2026-05-07T19:50:00Z by Claude (Phase 27 Plan 02 — D-06 closure)_
