# BRAND GUIDELINES CHANGELOG

This file tracks all changes to `brand-guidelines-v3.3.md`.

**Format:** Each entry includes version, date, time, git commit, and summary of changes.

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
