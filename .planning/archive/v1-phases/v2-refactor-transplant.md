# V2 Refactor: Transplant & Strip Roadmap

This document outlines the strategic pivot from building a fresh V2 codebase to performing a "Transplant & Strip" refactor directly on the V1 (`brain`) app. The goal is to strip V1 of heavy, deprecated AI features while transplanting the clean architecture, modern UI, and robust state management developed during the V2 phase.

## Phase 1: Demolition & Cleaning (✅ DONE)

* **Goal**: Eradicate code bloat, reduce compilation times, and remove deprecated features.
* **Tasks**:
  * [x] Delete `src/components/chat/`
  * [x] Delete `src/components/content-hub/`
  * [x] Delete `src/components/content-library/`
  * [x] Delete `src/components/profits/`
  * [x] Replace `framer-motion` globally with lightweight `motion/react`.
  * [x] Purge any broken imports connected to AI features across the app layout (e.g., in CallDetailPage, VaultJoin).
  * [x] Ensure `npm run build` is flawlessly green.

## Phase 2: Transplants & Foundation (✅ DONE)

* **Goal**: Inject modern components and patterns into the clean V1 shell.
* **Tasks**:
  * [x] Copy the `src/components/ui/` folder from the `callvault` V2 repo into V1 to standardize Radix primitives.
  * [x] Inject `orgContextStore` from V2 to prepare for the new state management structure of (Organization -> Workspace -> Folder).
  * [x] Standardize on `npm` as the package manager and resolve configuration discrepancies (moved local dev port to `3001`).

## Phase 3: Wiring Data & Context (✅ DONE)

* **Goal**: Connect the raw UI of V1 to the clean Zustand-driven state of V2.
* **Tasks**:
  * [x] Evaluate V1's `AppShell.tsx` and context providers.
  * [x] Introduce `orgContextStore` to the global routing/layout level.
  * [x] Bind left-hand Navigation layers and folder selection to Zustand instead of the legacy React Context.
  * [x] Update the `useRecordings` or equivalent data fetching hooks in the central pane to pull directly based on the new active workspace/folder.

## Phase 4: UI Unification (🧪 IN PROGRESS)

* **Goal**: Eradicate scattered, custom UI elements and unify them under the new standard V2 design system.
* **Tasks**:
  * [x] Audit and remove hacky V1 dropdowns, tabs, and modals (Replaced with V2 Radix).
  * [x] Swap the old V1 buttons for the new unified Radix `<Button>` implementations (Done in AppShell, VaultsPage, etc.).
  * [x] Refactor the Dialog/Flyout infrastructure using the V2 generalized layouts (Verified in `VaultsPage`).
  * [ ] Ensure all page headers follow the unified `PageHeader` pattern.

## Phase 5: Polish & Deployment Prep (📝 NEXT)

* **Goal**: Verify final product feel and performance.
* **Tasks**:
  * [ ] Perform manual click-testing and visual validation in `localhost:3001`.
  * [ ] Final data structure audit: ensure the database calls match the most current production database schema.
  * [ ] Cut the final RC branch from `v2-refactor` and merge into `main` for deployment.
