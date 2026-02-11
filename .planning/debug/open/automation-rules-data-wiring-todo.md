# TODO: Automation Rules Data Wiring + Route Consolidation

Date: 2026-02-10
Status: Partially complete (redirect shipped, long-term decision pending)

## Problem

- `/automation-rules` currently reads `automation_rules`.
- Existing user-facing rule management already lives in `sorting-tagging/rules` (`tag_rules` + related flows).
- This can make automation pages appear empty while users already have rules in the system.

## Decision Direction

Use the existing Sorting/Tagging rules implementation as the source of truth for now, and avoid introducing a parallel rules surface.

## Follow-up Work

1. Decide canonical route behavior:
   - Option A: Redirect `/automation-rules` -> `/sorting-tagging/rules` (implemented)
   - Option B: Keep `/automation-rules` route but render the same underlying rules data/components as sorting rules
2. Confirm whether Option A is final or temporary.
3. If Option B is chosen later, unify data model usage so one rules dataset is shown consistently.
4. Add migration/bridge plan if `automation_rules` is intended to supersede `tag_rules` later.
5. Add QA checks for users with existing rules to verify visibility on the canonical route.

## Acceptance Criteria

- A user with existing rules sees them in the chosen canonical route.
- No duplicate empty rules experiences for the same account.
- Route + data behavior is explicitly documented.
