---
phase: quick-001-update-workspace-hub-tab-indicator-to-ho
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/settings/BanksTab.tsx
  - src/components/panes/SettingsCategoryPane.tsx
autonomous: true
must_haves:
  truths:
    - "In Settings > Workspaces & Hubs, the active workspace tab is shown with a horizontal floating pill indicator instead of an underline accent."
    - "In the settings side selector, the active Admin category uses the same offset vertical pill selection style as other rows without extra orange accent treatments."
    - "Keyboard and click navigation still switch tabs/categories correctly with visible active state."
  artifacts:
    - path: "src/components/settings/BanksTab.tsx"
      provides: "Workspace/Hub tab trigger styling using floating horizontal pill active state"
    - path: "src/components/panes/SettingsCategoryPane.tsx"
      provides: "Offset vertical pill active state with neutralized extra accent styling for settings category rows"
  key_links:
    - from: "src/components/settings/BanksTab.tsx"
      to: "TabsTrigger data-state=active classes"
      via: "className overrides for active/inactive visual treatment"
      pattern: "data-\[state=active\]"
    - from: "src/components/panes/SettingsCategoryPane.tsx"
      to: "selectedCategory"
      via: "isActive conditional classes on indicator, icon, and text"
      pattern: "selectedCategory === category.id"
---

<objective>
Update two related selection affordances so the workspace/hub tab state reads as a horizontal floating pill and the admin side selector state reads as an offset vertical pill without layered orange accents.

Purpose: Improve wayfinding clarity and reduce visual noise while preserving existing navigation behavior.
Output: Updated tab and side-selector active-state styling in the settings experience.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/settings/BanksTab.tsx
@src/components/panes/SettingsCategoryPane.tsx
@src/components/ui/tabs.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert workspace/hub tab active state to horizontal floating pill</name>
  <files>src/components/settings/BanksTab.tsx</files>
  <action>Adjust the TabsList/TabsTrigger usage in BanksTab to implement a horizontal floating pill active indicator (rounded capsule background with subtle elevation/contrast) and explicitly suppress the default underline-style indicator for this surface. Keep icon + label alignment and current tab switching behavior unchanged.</action>
  <verify>Run `npm run typecheck` and confirm no TS errors in BanksTab-related code paths.</verify>
  <done>Active workspace tab is visually represented as a horizontal floating pill; inactive tabs remain clearly distinguishable; tab switching still works via click and keyboard.</done>
</task>

<task type="auto">
  <name>Task 2: Replace admin side selector accents with offset vertical pill style</name>
  <files>src/components/panes/SettingsCategoryPane.tsx</files>
  <action>Refine active row styling so the selected category (including Admin) uses the offset left vertical pill as the primary state signal. Remove redundant orange-accent emphasis (text/icon/border overlays) that competes with the pill, while preserving hover, focus-visible ring, and accessibility attributes.</action>
  <verify>Run `npm run typecheck` and `npm run dev`; verify `/settings` renders without console errors and active category transitions remain smooth.</verify>
  <done>Admin and other selected categories show a clean offset vertical pill active state without stacked orange accents; keyboard navigation and ARIA current state are intact.</done>
</task>

<task type="auto">
  <name>Task 3: Visual QA pass for both selectors</name>
  <files>src/components/settings/BanksTab.tsx, src/components/panes/SettingsCategoryPane.tsx</files>
  <action>Use browser automation to validate the new indicators in desktop and mobile widths: check `/settings/banks` for the horizontal floating tab pill and `/settings` for the side selector behavior, including the Admin row when visible for admin users. Capture screenshots for both views.</action>
  <verify>Playwright screenshots at 1440px and 390px show expected active-state visuals; no runtime console errors.</verify>
  <done>Both updated indicators are visually correct, responsive, and consistent with existing navigation interactions.</done>
</task>

</tasks>

<verification>
- `npm run typecheck`
- `npm run dev`
- Playwright visual check on `/settings` and `/settings/banks` (desktop + mobile)
</verification>

<success_criteria>
- Workspace/hub tabs use a horizontal floating pill active indicator in Banks settings.
- Settings side selector (including Admin) uses offset vertical pill as primary active state marker.
- No regressions in tab/category navigation, focus states, or responsive behavior.
</success_criteria>

<output>
After completion, create `.planning/quick/001-update-workspace-hub-tab-indicator-to-ho/001-SUMMARY.md`
</output>
