---
phase: quick-002-complete-ui-brand-audit-fix-hub-header-a
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/002-complete-ui-brand-audit-fix-hub-header-a/002-AUDIT.md
  - src/components/panes/VaultListPane.tsx
  - src/components/panes/VaultDetailPane.tsx
  - src/components/panes/SettingsDetailPane.tsx
  - src/pages/VaultsPage.tsx
  - docs/design/brand-guidelines-v4.2.md
  - docs/brand-guidelines-changelog.md
autonomous: true
must_haves:
  truths:
    - "The HUB (Vaults/Banks) pane header is visually on-brand, includes an icon, and does not overlap/truncate awkwardly on desktop layouts."
    - "Vaults page headers and middle-pane headers use consistent typography, spacing, and tokenized surface/border treatments."
    - "No new UI regressions are introduced while concurrent tab-indicator refresh work lands (pill style remains intact, no clip-path fallback reintroduced)."
    - "Brand guidelines document the current header and tab direction plus hardcoded-value rules so future UI work follows the same system."
  artifacts:
    - path: ".planning/quick/002-complete-ui-brand-audit-fix-hub-header-a/002-AUDIT.md"
      provides: "Route-by-route visual + code audit findings with hardcoded-value inventory and prioritized fixes"
    - path: "src/components/panes/VaultListPane.tsx"
      provides: "Updated HUB header composition (icon, responsive layout, non-overlapping bank context area)"
    - path: "src/components/panes/VaultDetailPane.tsx"
      provides: "Middle-pane header styling aligned with shared brand treatments used in Vaults flow"
    - path: "docs/design/brand-guidelines-v4.2.md"
      provides: "Current-state guidance for pane headers, tab indicator direction, and token-first styling constraints"
  key_links:
    - from: "src/components/panes/VaultListPane.tsx"
      to: "src/pages/VaultsPage.tsx"
      via: "secondary-pane header layout and responsive width behavior"
      pattern: "header className|HUBS|BankSwitcher"
    - from: "src/components/panes/VaultDetailPane.tsx"
      to: "src/components/panes/SettingsDetailPane.tsx"
      via: "consistent pane-header class and typography patterns"
      pattern: "font-montserrat|uppercase|border-b"
    - from: "docs/design/brand-guidelines-v4.2.md"
      to: "src/components/panes/VaultListPane.tsx"
      via: "documented header/tab rules mirrored in implementation"
      pattern: "Tab Navigation|Navigation & Selection States|hardcoded"
---

<objective>
Complete a focused UI/brand audit and ship corrective updates for the HUB header and related pane surfaces so Vaults experience is clean, consistent, and fully aligned to current brand direction.

Purpose: Remove visual drift, eliminate avoidable hardcoded styling debt, and keep current tab indicator modernization stable while polishing Vaults/HUB UX.
Output: Audit artifact, updated HUB/middle-pane UI implementation, and refreshed brand guidelines/changelog that match the shipped interface.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/CLAUDE.md
@docs/CLAUDE.md
@src/components/panes/VaultListPane.tsx
@src/components/panes/VaultDetailPane.tsx
@src/components/panes/SettingsDetailPane.tsx
@src/pages/VaultsPage.tsx
@docs/design/brand-guidelines-v4.2.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Execute complete visual + code audit and capture actionable findings</name>
  <files>.planning/quick/002-complete-ui-brand-audit-fix-hub-header-a/002-AUDIT.md</files>
  <action>Run a full UI audit across app routes/tabs and key pane states (desktop + mobile) and a code audit for hardcoded UI values that should be token/utility-driven (focus on production UI files, exclude tests/generated/debug-only surfaces unless they leak into user-facing routes). Record findings in 002-AUDIT.md with: route checked, issue, severity, file path, and explicit fix decision (fix now vs defer). Include a short note that tab indicators may have concurrent in-flight edits and that implementation should refresh file state before applying final styling changes.</action>
  <verify>Audit document exists and includes sections for visual audit coverage, hardcoded-value inventory, prioritized remediation list, and explicit mention of concurrent tab-indicator state handling.</verify>
  <done>There is a concrete, implementation-ready audit backlog for this quick scope with no ambiguous findings.</done>
</task>

<task type="auto">
  <name>Task 2: Fix HUB header and align Vaults pane/middle-pane styling</name>
  <files>src/components/panes/VaultListPane.tsx, src/components/panes/VaultDetailPane.tsx, src/components/panes/SettingsDetailPane.tsx, src/pages/VaultsPage.tsx</files>
  <action>Implement the high-priority fixes from the audit: update HUB header to on-brand composition with icon + label, strengthen responsive layout around bank title/switcher/create actions to eliminate desktop overlap, and align pane header typography/spacing/background/border treatments across Vault list pane, Vault detail pane, and adjacent detail-pane patterns. Replace hardcoded presentation values in these touched files with existing Tailwind tokens/utilities/CSS variables where possible. Before final edits, refresh current file state and preserve any newly landed pill-style tab indicator work; do not reintroduce clip-path-specific or legacy underline assumptions.</action>
  <verify>Run `npm run typecheck` and `npm run dev`; visually verify `/vaults` and relevant pane interactions at 1440px and 390px with no header overlap, no runtime console errors, and consistent pane styling.</verify>
  <done>HUB header is icon-led and non-overlapping, Vaults middle-pane/header surfaces are consistent and on-brand, and touched files use tokenized styling patterns without hardcoded drift.</done>
</task>

<task type="auto">
  <name>Task 3: Update brand guidelines to match shipped UI reality and rules</name>
  <files>docs/design/brand-guidelines-v4.2.md, docs/brand-guidelines-changelog.md</files>
  <action>Revise brand guidelines sections that govern tab/navigation indicators, pane headers, and token usage so they reflect the current app direction (including pill-style indicator direction and HUB/Vault header composition). Add explicit guidance for avoiding hardcoded UI values when equivalent Tailwind utilities or CSS variables exist, plus allowed exceptions. Apply documentation versioning rules in-file (patch-level update in the required three version locations) and add a changelog entry summarizing this audit-driven correction set.</action>
  <verify>`docs/design/brand-guidelines-v4.2.md` shows updated version metadata in all required locations and `docs/brand-guidelines-changelog.md` contains a new dated entry for this update.</verify>
  <done>Design guidance and shipped UI are synchronized, with clear rules preventing recurrence of the styling inconsistencies found in the audit.</done>
</task>

</tasks>

<verification>
- Validate audit completeness from `.planning/quick/002-complete-ui-brand-audit-fix-hub-header-a/002-AUDIT.md`
- `npm run typecheck`
- `npm run dev` and visual pass on `/vaults` (desktop 1440px + mobile 390px)
- Confirm brand guideline version/changelog updates are present and internally consistent
</verification>

<success_criteria>
- A complete audit artifact identifies and prioritizes visual and hardcoded-style issues across user-facing surfaces.
- HUB header in Vaults pane is on-brand, includes iconography, and has no desktop overlap regressions.
- Vaults page and middle/detail pane header treatments are visually consistent and token-driven.
- Brand guidelines/changelog now codify the current indicator/header direction and hardcoded-value policy.
</success_criteria>

<output>
After completion, create `.planning/quick/002-complete-ui-brand-audit-fix-hub-header-a/002-SUMMARY.md`
</output>
