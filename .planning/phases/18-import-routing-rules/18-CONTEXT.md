# Phase 18: Import Routing Rules - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create import routing rules with a condition builder, set priority order, preview match counts, and have a required default destination for unmatched calls. Rules apply to future imports only. Rules are organization-wide and can route to any workspace/folder in the org.

</domain>

<decisions>
## Implementation Decisions

### Condition builder UX
- Sentence-like builder: "When [field] [operator] [value], route to [workspace/folder]" — reads like natural language, each part is a dropdown/input inline
- AND/OR logic with toggle between conditions — user can switch per condition group
- Up to 5 conditions per rule
- 6 condition types: title contains, participant is, source is, duration greater than, tag is, date range (after/before)
- "+ Add another condition" link below conditions

### Rule management & priority
- Card list layout: each rule is a card showing sentence-like summary, destination, match count. Drag handle on left
- Rules require a name (e.g., "Q1 Reviews", "Acme Meetings") — makes rule list scannable
- Editing opens in a slide-over panel from the right (consistent with CallVault's detail pane pattern) — rule list stays visible underneath
- Each rule has an enabled/disabled toggle — disabled rules stay in list but are skipped during import. Useful for seasonal/temporary rules
- Drag-to-reorder for priority (first-match-wins engine)

### Preview & feedback
- Live preview: match count updates in real-time as conditions are added/changed
- Expandable detail: "See matching calls" expander shows actual call titles that would match
- Preview checks against last 20 calls
- Zero-match warning: yellow warning "This rule didn't match any of your last 20 calls. It may match future imports." — allows save anyway
- Overlap warning at design time: when creating/editing a rule, if another rule also matches some of the same calls, show non-blocking warning: "Heads up: Rule 'X' also matches N of these calls and has higher priority. It will run first."
- Routing trace at runtime: each routed call shows subtle gray badge "Routed by: [Rule Name]" on the call row. Hover/click shows popover with rule name, matched conditions, and timestamp

### Default destination & empty states
- Default destination is a top-level setting ABOVE the rule list (not a rule card): "Unmatched calls go to: [Workspace > Folder]" with helper text
- Default destination must be set before rules can be created
- Guided empty state when no rules exist:
  - Illustration + headline "Route new calls automatically"
  - Subtext: "Send calls from each source to the right workspace and folder as soon as they're imported. No more dragging recordings around."
  - Primary CTA: "Create your first rule"
  - Secondary: "Learn how routing works" (help sheet)
  - First rule creation suggests a sensible pattern (e.g., Source = Fathom) but does NOT pre-create it

### Navigation & scope
- Rules live inside Import Hub as a tab: Import Hub > Sources | Rules
- Rules are organization-wide (one ruleset per org) with workspace/folder targets — not per-workspace
- The Import Hub is org-scoped: one place to see and manage all routing logic
- Each rule's destination is any workspace/folder in the org
- Mental model: "Org has one rule list. Each rule sends calls to a specific workspace/folder. If no rule matches, calls go to the org default destination."

### Claude's Discretion
- Drag-to-reorder implementation (library choice, animation)
- Exact sentence-like builder component architecture
- AND/OR toggle visual design
- Help sheet content for "Learn how routing works"
- Badge/popover styling for routing trace
- DB schema design for rules table (priority column, conditions JSONB, etc.)

</decisions>

<specifics>
## Specific Ideas

- "Every routed call shows a tiny, low-noise tag like: 'Routed by: Q1 Reviews' (subtle gray, right side of row). Hover → popover with rule name, conditions that matched, timestamp."
- "Rules will misfire. People will misconfigure them. If they can't see what happened, they'll blame the product, not the rule." — routing visibility is a trust-building feature
- First rule creation should open with a suggested pattern (e.g., Source = Fathom → Current Workspace > Fathom Imports) but let user make a conscious first rule — don't pre-create silently
- "One brain routing calls for the whole org, not 5 half-broken brains scattered across workspaces" — org-wide rules with workspace targets
- Overlap warnings: "Heads up: Rule 'Q1 Reviews' also matches 3 of these calls and has higher priority. It will run first." — non-blocking, just informational

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-import-routing-rules*
*Context gathered: 2026-02-27*
