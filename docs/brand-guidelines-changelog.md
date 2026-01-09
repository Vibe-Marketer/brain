# Brand Guidelines Changelog

Track all changes to the CallVault Brand Guidelines document.

---

## v4.1.3 - January 8, 2026

**Type:** Feature update (Loop-style navigation patterns)

### Summary

Comprehensive navigation system upgrade implementing Microsoft Loop-inspired icon system and selection states. Replaces all emoji icons with Remix Icon fill/line variants, adds Loop-style sidebar collapse/expand UX, and documents all new navigation patterns.

### Changes

#### Icon System

- **Icon Library:** All navigation icons now use Remix Icons exclusively (no emojis)
- **Fill/Line Variants:** Active state shows Fill variant, inactive shows Line variant
- **Main Sidebar:** 🏠→RiHome4Line/Fill, ✨→RiSparklingLine/Fill, 🏷️→RiPriceTag3Line/Fill, ⚙️→RiSettings3Line/Fill
- **Settings Categories:** Added fill variants for Account, Users, Billing, Integrations, AI, Admin
- **Sorting Categories:** Added fill variants for Folders, Tags, Recurring (Rules uses line with color)
- **Folder Sidebar:** Selected folders show RiFolderFill (custom emoji icons unchanged)

#### Navigation & Selection States

- **Pill Indicator:** Absolute left-0, w-1, h-[80%], rounded-r-full, bg-vibe-orange
- **Icon State:** Vibe-orange color on active, muted gray on inactive
- **Background:** bg-vibe-orange/10 (light) / bg-vibe-orange/20 (dark)
- **Animation:** 200ms ease-in-out for state transitions
- **Keyboard Navigation:** Arrow keys, Home/End, Enter/Space support added

#### Sidebar UX Patterns

- **Loop-Style Toggle:** Click-anywhere-to-toggle with floating edge button
- **Z-Index Hierarchy:** Overlay z-0, content z-10, toggle button z-20
- **Toggle Button:** Circular, -right-3 position, chevron icon with rotation
- **Transition Timing:** 500ms ease-in-out for width changes
- **stopPropagation:** Toggle button works independently from overlay

#### Documentation Added

- New "Icon Fill/Line Variant Pattern" subsection with complete icon mappings
- New "Navigation & Selection States" section with pill indicator specs
- New "Sidebar UX Patterns" section with Loop-style implementation details
- Updated Prohibited section to clarify vibe-orange exception for icons

#### Components Updated

- `src/components/ui/sidebar-nav.tsx` - Remix Icons with fill/line variants
- `src/components/panes/SettingsCategoryPane.tsx` - Icon fill variants + selection states
- `src/components/panes/SortingCategoryPane.tsx` - Icon fill variants + selection states
- `src/components/transcript-library/FolderSidebar.tsx` - RiFolderFill for selected folders
- `src/pages/Settings.tsx` - Loop-style sidebar toggle
- `src/pages/SortingTagging.tsx` - Loop-style sidebar toggle
- `src/pages/TranscriptsNew.tsx` - Loop-style sidebar toggle

---

## v3.4 - December 5, 2025

**Type:** Minor version bump (file renamed from v3.3 to v3.4)

### Summary

Complete rebrand from "Conversion Brain" to "CallVault" with primary accent color change from vibe-green to vibe-orange.

### Changes

#### Brand Identity

- **Product Name:** "Conversion Brain" → "CallVault"
- **Trademark:** Added ™ symbol (CallVault™)
- **Domain:** conversion.brain → callvault.ai

#### Color System

- **Primary Accent:** vibe-green (#D9FC67) → vibe-orange (#FF8800)
- **HSL Values:** 72 96% 70% → 32 100% 50%
- **CSS Variables:** All `--vibe-green-*` tokens renamed to `--vibe-orange-*`
- **Tailwind Classes:** All `vibe-green` utilities renamed to `vibe-orange`

#### Usage Updates

All 9 approved accent color uses updated:

1. Active tab underlines (6px angular)
2. Left-edge indicators on metric cards
3. Table column header underlines (sortable)
4. Focus states (inputs, buttons)
5. Circular progress indicators
6. Progress trackers (onboarding)
7. Wayfinding step indicators
8. Section dividers
9. Contextual info banners

#### Code Examples

- All component examples updated with `vibe-orange` classes
- CSS variable references updated
- Tailwind config examples updated

---

## v3.3.9 and Earlier

See git history for previous versions. Major versions prior to v3.4 used "Conversion Brain" branding with vibe-green (#D9FC67) accent color.
