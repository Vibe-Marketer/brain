# BRAND GUIDELINES CHANGELOG

This file tracks all changes to the brand guidelines document.

**Format:** Each entry includes version, date, time, git commit, and summary of changes.

---

## v4.3 (February 28, 2026)

**Git Commit:** 53aa185, 35e9b3e
**Summary:** Phase 16.1 audit findings — v2 AppShell architecture, spring animations, nav pill, import tabs, dialog buttons

- **ADDED:** v2 AppShell 4-pane architecture section (motion/react spring physics, flex row composition, OrgSwitcherBar)
- **ADDED:** Spring animation system documentation (stiffness 260, damping 28, import from `motion/react`)
- **UPDATED:** Navigation pill indicator height from `h-4/5` to `h-[65%]` to match actual v2 implementation
- **ADDED:** Custom button-tab pattern for Import page (Sources/Rules tab bar using button elements)
- **ADDED:** Dialog button exception (bg-brand-500 inside Radix Dialog action buttons is acceptable)
- **UPDATED:** File renamed from brand-guidelines-v4.2.md to brand-guidelines-v4.3.md (5 sections changed = minor version bump per docs/CLAUDE.md)
- **ARCHIVED:** brand-guidelines-v4.2.md moved to docs/archive/

---

## v4.1.3 (January 8, 2026)

**Git Commit:** pending
**Summary:** Icon Fill/Line Variant Pattern documentation

- **ADDED:** New "Icon Fill/Line Variant Pattern (Navigation)" subsection to Icon System
  - Documents `-Line` to `-Fill` icon swapping for navigation active states
  - Pattern summary table showing inactive vs active variants
  - Complete navigation icon mappings (13 components with line/fill variants)
  - Implementation code example with NavItem interface and conditional rendering
  - Visual state combination explanation (fill icon + vibe orange + pill indicator + background)
  - Transition timing specifications
- **UPDATED:** Prohibited section to clarify vibe orange icon exception for navigation active states
- **UPDATED:** Document version to v4.1.3 in 3 places (title, DOCUMENT VERSION, END)
- **UPDATED:** Last Updated date to January 8, 2026

---

## v4.1.1 (December 9, 2025)

**Git Commit:** pending
**Summary:** New Sidebar Navigation Pattern with Glossy 3D Icons and Edge-Mounted Collapse Toggle

- **UPDATED:** Complete rewrite of "Sidebar Layout Pattern" section to reflect new implementation
- **ADDED:** "Sidebar Structure Hierarchy" documenting 3-tier layout (Nav Icons → Separator → Content)
- **ADDED:** "Edge-Mounted Collapse Toggle" subsection with:
  - Toggle now on sidebar edge (not in header)
  - 24x24px circular button specifications
  - Chevron icon behavior (left/right arrows)
  - Usage code example with SidebarCollapseToggle component
- **ADDED:** "Sidebar Navigation Icons (SidebarNav)" subsection with:
  - 4 primary nav items (Home, AI Chat, Sorting, Settings)
  - Glossy 3D icon styling for light AND dark mode
  - Icon button specifications (44x44px, rounded-xl)
  - Active indicator dot (6x6px orange)
  - Layout behavior for expanded/collapsed states
- **UPDATED:** Reference implementations to include new components:
  - sidebar-collapse-toggle.tsx
  - sidebar-nav.tsx
  - TranscriptsNew.tsx (instead of TranscriptsTab)
- **UPDATED:** Container structure code example with new component imports

---

## v4.1 (December 9, 2025)

**Git Commit:** pending
**Summary:** Sidebar Layout Pattern documentation

- **ADDED:** New "Multi-Card and Sidebar Layouts" section replacing placeholder "Future Multi-Card Support"
- **ADDED:** Comprehensive "Sidebar Layout Pattern" subsection with:
  - Container structure using `ChatOuterCard` + `ChatInnerCard`
  - Required specifications table (expanded: 280px, collapsed: 56px)
  - State management code examples
  - Toggle button placement and icon specifications (RiLayoutLeftLine, RiMenuLine)
  - Collapsed sidebar content pattern
  - Mobile responsive behavior with backdrop overlay
  - Reference implementation links to TranscriptsTab, FolderSidebar, chat-main-card
- **ARCHIVED:** v3.3.md and v3.4.md to docs/archive/

---

## v4.0 (December 4, 2025)

**Git Commit:** pending
**Summary:** Major version - rebrand and comprehensive expansion

- **RENAMED:** Product from "CallVault" to "Call Vault"
- **ADDED:** Brand Identity & Logo section with:
  - Brand name usage table (Call Vault, Call Vault AI, CALLVAULT)
  - Logo asset specifications (Full Logo, Wordmark Only, Icon Only)
  - Icon design specifications (glassy play button with molten waveform)
  - Wordmark design (CALL dark metallic, VAULT orange gradient)
  - Logo clear space and misuse guidelines
- **ADDED:** Gradient usage specifications ("White Hot to Lava" direction)
- **UPDATED:** Color system with refined vibe orange gradient colors
- **UPDATED:** Supersedes notice to reference "CallVault v3.3.9"

---

## v3.3.9 (November 26, 2025)

**Git Commit:** pending
**Summary:** Button System expansion from 4 to 6 variants

- **ADDED:** `variant="outline"` - Subtle bordered button for toggleable/selectable items
  - Designed to pair with `default` for selected state toggle pattern
  - Use case: Filter toggles, tag selection, suggestion chips, date presets
  - Transparent background, subtle border, hover state brings focus
- **ADDED:** `variant="ghost"` - Transparent button for minimal UI contexts
  - No border, subtle hover state
  - Use case: Code block actions, toolbar icons, inline subtle actions
  - Default behavior for icon buttons without specified variant
- **REMOVED:** `variant="secondary"` from Button types (was only used on Badge component)
- **UPDATED:** Button Usage Decision Tree to include new variants
- **UPDATED:** Button checklist in QA section to reflect 6 variants
- **IMPLEMENTED:** Proper styling in `src/components/ui/button.tsx` for both new variants
- **FIXED:** 7 existing usages of `variant="outline"` now have proper styling (previously fell back to default glossy)

---

## v3.3.8 (November 21, 2025)

**Git Commit:** pending
**Summary:** Vibe Green status indicator + Icon library enforcement

- **ADDED:** 10th approved use of vibe green: Top Status Indicator Bar
  - Full-width horizontal bar at top of page/section for system-wide states
  - Height: 1-2px maximum
  - Used for temporary status states (loading, syncing, processing)
  - Disappears when action completes
- **UPDATED:** FathomSetupWizard to use Remix Icons exclusively (removed all Lucide imports)
- **CHANGED:** Welcome wizard icon from Shield to Brain (RiBrainLine)
- **FIXED:** All wizard step titles now UPPERCASE per typography guidelines
- **FIXED:** Removed card-like bordered containers from Settings page tabs per 90% rule

---

## v3.3.7 (November 19, 2025)

**Git Commit:** pending
**Summary:** Major guidelines expansion - Card usage, Typography, Vibe Green, Microcopy

- **EXPANDED:** THE 10% Approved Card Usage with 3 new permitted uses:
  - Onboarding tips
  - Task/status banners
  - Temporary informational callouts
- **UPDATED:** Typography Rules to clarify ALL CAPS vs sentence/title case usage
  - Headers/UI labels: ALL CAPS
  - Body text/microcopy: Sentence case for approachability
- **EXPANDED:** Vibe Green Usage Rules with 4 additional approved uses:
  - Progress trackers
  - Wayfinding/step indicators
  - Section dividers (onboarding only)
  - Contextual info banners
- **ADDED:** Floating Action Shadows to Component Specifications
- **ADDED:** New MICROCOPY & QUIPS section (section 18)
  - Tone guidelines for clever, human, encouraging copy
  - Example quips and usage rules
  - Emojis still prohibited, but wit encouraged
- **FIXED:** Prohibited Patterns reference to use Remix Icon instead of Lucide

---

## v3.3.6 (November 19, 2025)

**Git Commit:** pending
**Summary:** Icon System standardization

- **ADDED:** New Icon System section (section 5 in TOC)
- **SPECIFIED:** Remix Icon as the official icon library (`@remixicon/react`)
- **ADDED:** Installation instructions and naming conventions
- **ADDED:** Common icon mappings table with 20+ icons
- **ADDED:** Migration guide from Lucide and React Icons
- **ADDED:** Size specifications, styling guidelines, and accessibility requirements
- **PROHIBITED:** Mixing icon libraries (must use only Remix Icon)

---

## v3.3.5 (November 18, 2025, 11:55 PM)

**Git Commit:** dac15da
**Summary:** Versioning process fixes

- **FIXED:** END OF BRAND GUIDELINES version mismatch (was v3.3.1, now matches title)
- **CLARIFIED:** Version must be updated in 3 places (title, DOCUMENT VERSION, END)
- **UPDATED:** Critical notice and CLAUDE.md with 3-place rule

---

## v3.3.4 (November 18, 2025, 11:45 PM)

**Git Commit:** 15be2bc
**Summary:** Changelog extraction and tracking improvements

- **MOVED:** VERSION HISTORY to separate brand-guidelines-changelog.md
- **ADDED:** Time tracking for all changes
- **ADDED:** Git commit hash tracking
- **UPDATED:** Versioning rules for filename updates (minor versions only)

---

## v3.3.3 (November 18, 2025)

**Summary:** Versioning rules clarification

- **UPDATED:** Versioning guidelines with clear Claude vs user responsibilities
- **CLARIFIED:** Patch/minor/major version decision authority
- **CLARIFIED:** Initial versions use two digits (v3.3 not v3.3.0)

---

## v3.3.2 (November 18, 2025)

**Summary:** Tab styles enforcement

- **UPDATED:** Tab styles now ENFORCED (justify-start, gap-6, px-0 m-0 cannot be overridden)
- **UPDATED:** Code example shows enforced pattern (critical classes after className)
- **ADDED:** Prohibitions for grid layouts and padding/margin overrides on tabs
- **FIXED:** Clip-path to 5/95 trapezoid shape (narrow top, wide bottom)
- **ADDED:** Prominent versioning requirement notice at document top

---

## v3.3.1 (November 18, 2025)

**Summary:** Tab component standardization

- **UPDATED:** `tabs.tsx` component to match brand guidelines exactly
- **ADDED:** Exact component implementation code to Tab Navigation section
- **CLARIFIED:** Tabs are left-justified by default, same component for pages and modals
- **ADDED:** Tab Label entries to Type Scale (inactive/active states)
- **ADDED:** UPPERCASE rule for all UI labels in Typography Rules
- **ADDED:** Versioning guidelines section

---

## v3.3 (November 18, 2025)

**Summary:** Tab typography specifications

- **ADDED:** Tab typography table (inactive vs active weight/color)
- **ADDED:** Component reference and purpose to Tab Navigation

---

## v3.2 (November 18, 2025)

**Summary:** Comprehensive update

- **ADDED:** 10 Percent Approved Card Usage section
- **ADDED:** Conversation Dialogue UI Rule Exception
- **ADDED:** Metric card standardized dimensions
- **CORRECTED:** Layout measurements (8px gutters, not 48px)

---

## v3.1 (November 18, 2025)

**Summary:** Critical corrections applied

- **FIXED:** Layout diagram measurements (8px gutters, not 48px)
- **ADDED:** Tab Navigation section with angular underline specifications
- **ADDED:** Content Padding Rules (scrollable vs static pages)
- **EXPANDED:** Metric Card section with standardized marker dimensions
- **ADDED:** Icon Button implementation code with corrections
- **CLARIFIED:** TopBar flush positioning (no gap)
- **STANDARDIZED:** Vibe green marker at w-1.5 h-14 with 10%/90% angle
- **DOCUMENTED:** When to use px-10 only vs px-10 pb-10 pt-2
- **REMOVED:** Incorrect "48px" references throughout
- **ADDED:** CRITICAL rules about never using rounded-t-sm on tabs

---

## v3.0 (November 17, 2025)

**Summary:** Complete rewrite

- Added background hierarchy (viewport vs. content)
- Standardized button system (4 variants)
- Removed incorrect theme inversion rules
- Added mobile specifications
- Added layout architecture
- Added CSS variable reference

---

## v2.2 (Previous)

**Summary:** Original brand guidelines

- Had incomplete button specifications
- Missing layout architecture
- Incorrect dark mode behavior for buttons
