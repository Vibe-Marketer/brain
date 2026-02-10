# Quick 002 UI + Brand Audit

Date: 2026-02-10
Scope: Visual and code audit for active user-facing routes, with implementation focus on the `/vaults` HUB flow.

## Audit Method

- Visual sweep at desktop and mobile breakpoints for major routes/tabs: `/vaults`, `/settings`, `/chat`, `/transcripts`, `/sorting-tagging`.
- Code audit for hardcoded presentation values in production UI files, with emphasis on pane headers/navigation markers and vault surfaces.
- Excluded test/generated/debug-only files.

## Visual Audit Coverage

| Route | Viewports | States Checked | Issues | Severity | Fix Decision |
| --- | --- | --- | --- | --- | --- |
| `/vaults` | 1440px, 390px | default, selected hub, empty, error, settings-action affordances | HUB header hierarchy not fully on-brand; desktop bank context/switcher/action density risks overlap/truncation; header treatments drift between left/middle panes | High | Fix now |
| `/settings` | 1440px, 390px | category list, detail pane transitions, pane header actions | Detail pane header style partially diverges from current Vaults middle-pane treatment and token-first guidance | Medium | Fix now (alignment only in shared-adjacent pane file) |
| `/chat` | 1440px, 390px | main route load, primary tabs, sidebar states | No critical issue in scope; monitor tab indicator consistency while in-flight edits land | Low | Defer |
| `/transcripts` | 1440px, 390px | list/table, sidebar, tab row | No blocking issue for this quick scope; verify indicator style remains pill-based after concurrent work | Low | Defer |
| `/sorting-tagging` | 1440px, 390px | pane headers, list selection | No blocking issue for this quick scope | Low | Defer |

## Hardcoded-Value Inventory (Production UI)

| File | Hardcoded / Drift Pattern | Why It Is a Problem | Severity | Fix Decision |
| --- | --- | --- | --- | --- |
| `src/components/panes/VaultListPane.tsx` | Header split into mixed text styles (`font-bold` + non-tokenized hierarchy), ad-hoc spacing between bank context and HUB label | Inconsistent with documented pane-header system; increases truncation/overlap risk in constrained desktop widths | High | Fix now |
| `src/components/panes/VaultListPane.tsx` | Active hub row uses `bg-gray-100 dark:bg-gray-800` | Bypasses semantic surface tokens and can drift from brand palette over time | Medium | Fix now |
| `src/components/panes/VaultListPane.tsx` | Type badges rely on direct color families (`blue/green/purple/...`) | Acceptable for semantic tags, but needs explicit rule boundary in docs to avoid uncontrolled hardcoding elsewhere | Medium | Defer code change, document exception |
| `src/components/panes/VaultDetailPane.tsx` | Header border/background treatment differs from adjacent detail-pane patterns | Visual inconsistency between middle and adjacent panes in the same flow | High | Fix now |
| `src/components/panes/SettingsDetailPane.tsx` | Header icon/title wrappers use pane-local styling not aligned to current Vaults header language | Reinforces drift across pane ecosystem | Medium | Fix now |
| `src/pages/VaultsPage.tsx` | Mobile overlay header uses standalone `font-semibold`/plain title treatment | Minor mismatch against HUB uppercase/montserrat framing | Low | Fix now (small alignment touch) |

## Prioritized Remediation Backlog

1. P0: Recompose Vault list-pane header to on-brand HUB composition with icon + label, and robust responsive row layout for bank title/switcher/create actions.
2. P0: Normalize Vault list/detail/settings pane header surfaces to shared tokenized border/background/typography patterns.
3. P1: Replace non-semantic row surface classes in touched files with neutral tokens/utilities (remove gray literal drift).
4. P1: Document hardcoded-value policy and explicit exceptions in brand guidelines, including navigation indicator direction and pane header standards.

## Concurrent Tab-Indicator Handling Note

Concurrent tab-indicator modernization work (clip-path marker to pill-style direction) may land while this quick task is in progress. Before final UI commits, refresh local file state for touched pane/page files and preserve any newly landed pill-indicator implementation. Do not reintroduce legacy clip-path underline assumptions.
