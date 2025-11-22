# Settings Page - Brand Guidelines Violations

**Analysis Date:** 2025-11-20
**File:** `src/pages/Settings.tsx` (1600 lines)
**Status:** CRITICAL - Multiple systematic violations

---

## 🚨 CRITICAL VIOLATIONS

### 1. CARD OVERUSE (90% Rule Violation)

**Guideline:** "90% No Containers - Content on white, separated by thin lines and space"
**Guideline:** "The 10% - Cards/containers only for modals, dropdowns, search bars, metric cards"

**Violations Found:** 9+ Card components wrapping primary content

| Line | Card Type | Should Be |
|------|-----------|-----------|
| 521 | Setup Progress Card | Remove card, use white bg + border |
| 618 | Connection Status Card | Remove card, use white bg + border |
| 716 | Profile & Preferences Card | Remove card, use white bg + border |
| 966 | Profile Tab Card (duplicate) | Remove card, use white bg + border |
| 1216 | Fathom Connection Card | Remove card, use white bg + border |
| 1315 | Webhook Monitoring Card | Remove card, use white bg + border |
| 1343 | Meeting Data Card | Remove card, use white bg + border |
| 1402 | What's New Card | KEEP (metric/feature card - 10% exception) |
| 1487 | Delete Account Card | KEEP (danger zone card - acceptable) |

**Impact:** Page looks cluttered, not following "data first" principle

---

### 2. TYPOGRAPHY VIOLATIONS

**Guideline:** "Headings: ALWAYS Montserrat Extra Bold, ALL CAPS"
**Guideline:** "Interactive elements: ALWAYS Inter Medium (500)"

**Violations:**

| Line | Current | Should Be |
|------|---------|-----------|
| 503 | `text-4xl font-semibold tracking-tight` | `font-display text-4xl font-extrabold uppercase tracking-[0.06em]` |
| 525 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |
| 620 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |
| 718 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |
| 1218 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |
| 1317 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |
| 1345 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |
| 1404 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |
| 1489 | `text-lg font-semibold` (CardTitle) | `font-display text-lg font-extrabold uppercase` |

**Pattern:** ALL CardTitle components using wrong typography

---

### 3. LAYOUT/SPACING VIOLATIONS

**Guideline:** "Gutters: 48px desktop (inset-12), 16px mobile (inset-4)"
**Guideline:** "Card padding: 40px horizontal, 40px bottom, 8px top"

**Violations:**

| Line | Current | Should Be |
|------|---------|-----------|
| 501 | `container max-w-6xl py-10 px-6` | `inset-12 md:inset-12` (48px desktop, 16px mobile) |

**Issue:** Using generic `container` class instead of proper design tokens

---

### 4. REDUNDANT BACKGROUND COLORS

**Lines with `bg-card` inside cards:**
- 636: `border bg-card` (inside Card already)
- 666: `border bg-card` (inside Card already)
- 1234: `border bg-card` (inside Card already)
- 1264: `border bg-card` (inside Card already)

**Fix:** Remove `bg-card` - parent Card already provides background

---

### 5. TAB STYLING

**Line 510:** `<TabsList className="grid w-full grid-cols-4">`

**Guideline:** Active tab should have 3px vibe green underline
**Need to verify:** Does default Tabs component follow brand guidelines?

---

## 📋 FIX CHECKLIST

### Phase 1: Typography (Quick Fix)
- [ ] Line 503: Page title → Montserrat Extra Bold ALL CAPS
- [ ] Lines 525, 620, 718, 1218, 1317, 1345, 1404, 1489: All CardTitle → Montserrat Extra Bold ALL CAPS

### Phase 2: Remove Card Wrappers (90% Rule)
- [ ] Lines 521-614: Setup Progress - Remove Card, use `<div className="border rounded-lg p-6 bg-white dark:bg-card">`
- [ ] Lines 618-713: Connection Status - Remove Card wrapper
- [ ] Lines 716-960: Profile & Preferences - Remove Card wrapper
- [ ] Lines 966-1210: Profile Tab (duplicate) - Remove Card wrapper
- [ ] Lines 1216-1311: Fathom Connection - Remove Card wrapper
- [ ] Lines 1315-1336: Webhook Monitoring - Remove Card wrapper
- [ ] Lines 1343-1399: Meeting Data - Remove Card wrapper
- [ ] Lines 1402-1483: What's New - KEEP Card (10% exception)
- [ ] Lines 1487-1521: Delete Account - KEEP Card (danger zone)

### Phase 3: Fix Layout/Spacing
- [ ] Line 501: Change `container max-w-6xl py-10 px-6` → `max-w-6xl mx-auto py-10 px-4 md:px-12`

### Phase 4: Remove Redundant Backgrounds
- [ ] Lines 636, 666, 1234, 1264: Remove `bg-card` from inner divs

### Phase 5: Verify Tabs
- [ ] Check if Tabs component has vibe green underline on active state

---

## 🎯 EXPECTED OUTCOME

**Before:** Cluttered card-heavy design with inconsistent typography
**After:** Clean, data-first layout with proper hierarchy and whitespace

**Estimated Time:** 45-60 minutes
**Files Changed:** 1 (`Settings.tsx`)
**Breaking Changes:** None (visual only)

---

## 📐 REFERENCE

See **docs/design/brand-guidelines-v3.3.md** for complete specifications:
- Section 3: Layout Architecture
- Section 4: Button System
- Section 7: Typography
- Section 9: 10 Percent Approved Card Usage
