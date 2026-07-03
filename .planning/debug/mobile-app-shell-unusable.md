---
status: resolved
trigger: "mobile optimization for the app is way off; practically zero usability in a mobile state; cannot use the app from a cellphone/mobile device; no sidebar, no 2nd pane, no fourth pane; just third pane and nothing else"
created: 2026-06-30T23:36:44Z
updated: 2026-06-30T23:45:00Z
---

# Debug Session: mobile-app-shell-unusable

## Symptoms

- expected_behavior: "On a cellphone/mobile viewport, users can navigate the app, open the main nav/sidebar, access the route secondary pane, use pane 3 content, and access pane 4/detail actions when present."
- actual_behavior: "Mobile view exposes only the third/main pane; sidebar, second pane, and fourth/detail pane are not accessible."
- error_messages: "No reported runtime errors; symptom is responsive layout and navigation usability."
- timeline: "Reported 2026-06-30. Unknown whether mobile ever worked acceptably."
- reproduction: "Open authenticated app on a phone-sized viewport/mobile device; routes using AppShell strand the user in pane 3."

## Current Focus

- hypothesis: "AppShell has mobile overlay state for nav/secondary panes but no mobile controls to open those overlays, and it does not render a mobile detail-pane affordance."
- test: "Inspect AppShell mobile branch and verify controls are missing; add shell-level mobile pane access and validate with unit/build/browser checks."
- expecting: "Mobile layout exposes reachable buttons for menu, secondary pane, and detail pane without changing desktop behavior."
- next_action: "Done; keep broader per-page mobile polish as follow-up if specific pages still overflow inside pane 3."
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- 2026-06-30T23:36:44Z: User clarified mobile/cellphone usage is blocked because there is no sidebar, no second pane, no fourth pane, and only the third pane is visible.
- 2026-06-30T23:36:44Z: Code inspection found `showMobileNav` and `showMobileSecondary` state in `src/components/layout/AppShell.tsx`, but the mobile render branch only outputs pane 3 content.
- 2026-06-30T23:40:00Z: Browser mobile pass found the first bottom switcher patch exposed controls, but the overlay backdrop intercepted direct switching while a drawer was open; layering/drawer bottom bounds were adjusted.
- 2026-06-30T23:45:00Z: Mobile browser verification on `/settings` at 390x844 showed the bottom pane switcher visible at x=16 y=774 w=358 h=54 and the secondary pane settled at x=0 w=279 h=707.
- 2026-07-03T17:05:00Z: User clarified the sidebar itself should persist along the bottom on mobile. Updated solution from a `Menu` button to a persistent bottom primary nav (`Calls`, `Import`, `Rules`, `People`, `More`) with contextual pane controls (`Library`, `Details`) above it.
- 2026-07-03T17:10:00Z: Route audit at 390x844 passed for `/`, `/transcripts`, `/import`, `/settings`, `/analytics`, `/people`, `/organization`, and `/rules`: bottom primary nav visible, pane controls visible, no horizontal overflow, no console errors.

## Eliminated

## Resolution

- root_cause: "The AppShell mobile branch had overlay state for navigation and secondary panes, but rendered no mobile controls to open them and no detail-pane access path, leaving only pane 3 reachable."
- fix: "Added a persistent mobile primary navigation bar with Calls, Import, Rules, People, and More; added contextual mobile pane controls above it for secondary/detail panes; added mobile detail drawer support; replaced inline SVG close icons with Remix icons; kept drawers below the top bar and above the bottom nav."
- verification: "npm test -- --run src/components/layout/__tests__/AppShell.mobile.test.tsx; npm run build; Playwright mobile route audit at 390x844 for /, /transcripts, /import, /settings, /analytics, /people, /organization, /rules."
- files_changed: "src/components/layout/AppShell.tsx; src/components/layout/__tests__/AppShell.mobile.test.tsx; .planning/debug/mobile-app-shell-unusable.md"
