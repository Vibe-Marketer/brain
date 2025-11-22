# DESIGN TOKEN SYSTEM - Implementation Checklist

**Created:** 2025-11-20
**Estimated Time:** 2-3 hours total
**Status:** Ready to implement

---

## 📋 OVERVIEW

This checklist guides you through implementing the complete design token system to fix the root cause: inline colors everywhere instead of using a centralized token system.

---

## ✅ PHASE 1: Setup Token System (30 minutes)

### Step 1.1: Backup Current File
```bash
cp src/index.css src/index-BACKUP.css
```
**Status:** [ ] Complete

### Step 1.2: Replace index.css
```bash
mv src/index-UPDATED.css src/index.css
```
**What this does:**
- Adds button token system (--btn-bg-hollow-light, --btn-hover-hollow-light, etc.)
- Adds utility classes (.btn-hollow, .btn-ghost, .btn-icon-sm, etc.)
- Organizes all tokens in single source of truth

**Status:** [ ] Complete

### Step 1.3: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```
**Why:** Tailwind needs to reprocess the new CSS variables

**Status:** [ ] Complete

### Step 1.4: Verify Tokens Loaded
Open browser console and check:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--btn-hover-hollow-light')
// Should return: " 0 0% 97%"
```

**Status:** [ ] Complete

---

## ✅ PHASE 2: Run Migration Script (15 minutes)

### Step 2.1: Make Script Executable
```bash
chmod +x scripts/migrate-to-tokens.sh
```
**Status:** [ ] Complete

### Step 2.2: Run Migration
```bash
./scripts/migrate-to-tokens.sh
```

**What it does:**
- Replaces `hover:bg-cb-ink` → `hover:bg-cb-hover` (fixes BLACK hover)
- Replaces `#111111` → `bg-cb-ink` or `text-cb-ink`
- Replaces `#F8F8F8` → `bg-cb-hover`
- Replaces `#202020` → `dark:bg-card`
- Replaces `#E5E5E5` → `border-cb-border`
- Shows before/after counts
- Lists any remaining inline colors

**Status:** [ ] Complete

### Step 2.3: Review Changes
```bash
git diff src/
```

**Check for:**
- [ ] No `hover:bg-cb-ink` remains (BLACK → light gray)
- [ ] Reduced inline hex colors
- [ ] No breaking changes to class names

**Status:** [ ] Complete

---

## ✅ PHASE 3: Visual Testing (30 minutes)

### Step 3.1: Test Pagination Buttons
**URL:** http://localhost:5173/library (or your transcripts page)

**Test:**
- [ ] Pagination arrows (< >) have visible border
- [ ] Hover state is LIGHT GRAY (not black)
- [ ] Dark mode: border visible, light gray hover
- [ ] Focus state: vibe green outline

### Step 3.2: Test Table Icon Buttons
**Same URL**

**Test:**
- [ ] View/Edit/Download icons have NO border
- [ ] Hover state is light gray (transparent → light gray)
- [ ] Icons are properly sized (responsive)
- [ ] Dark mode works correctly

### Step 3.3: Test Table Badge Buttons
**Same URL**

**Test:**
- [ ] Participant count button has border
- [ ] White background in light mode
- [ ] Icon + number display together
- [ ] Hover is light gray (not black)
- [ ] Dark mode: #202020 background, border visible

### Step 3.4: Test Search Button
**Check any page with search**

**Test:**
- [ ] Search icon button has border
- [ ] White background
- [ ] Light gray hover (not black)
- [ ] Dark mode works

### Step 3.5: Test Primary/Secondary Buttons
**Check Settings page or any modals**

**Test:**
- [ ] Primary buttons (Save/Submit) have slate gradient
- [ ] Secondary buttons (Cancel) have border + white bg
- [ ] Destructive buttons (Delete) have red gradient
- [ ] Focus states show vibe green outline
- [ ] Dark mode: colors stay consistent

**Status:** [ ] All visual tests pass

---

## ✅ PHASE 4: Fix Button Component (30 minutes)

### Step 4.1: Update button.tsx Type Definition

**File:** `src/components/ui/button.tsx`
**Line 9:**

```typescript
// FROM:
variant?: "default" | "destructive" | "hollow" | "link" | "outline" | "secondary";

// TO:
variant?: "default" | "destructive" | "hollow" | "link" | "ghost";
```

**Status:** [ ] Complete

### Step 4.2: Add type="button" Default

**File:** `src/components/ui/button.tsx`
**Line 88-89:**

```typescript
// FROM:
({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {

// TO:
({ className, variant = "default", size = "default", asChild = false, type = "button", ...props }, ref) => {
```

**Status:** [ ] Complete

### Step 4.3: Pass type to All Comp Renders

**In every `<Comp>` render, add `type={type}`:**

```typescript
<Comp
  ref={ref}
  type={type}  // ← Add this
  className={...}
  {...props}
/>
```

**Status:** [ ] Complete

### Step 4.4: Fix Icon Size Variant Hover

**File:** `src/components/ui/button.tsx`
**Lines 93-109 (icon size section):**

Replace the entire icon section with the code from `BUTTON-CODE-BUGS.md` (Step 3)

**Key change:**
```typescript
// FROM:
'hover:bg-cb-ink'  // BLACK

// TO (for hollow + icon):
'hover:bg-cb-hover dark:hover:bg-cb-panel-dark'  // Light gray

// OR (for ghost + icon):
'hover:bg-muted/50'  // Transparent hover
```

**Status:** [ ] Complete

### Step 4.5: Add Ghost Variant

**After hollow variant (line 154), add:**

See `BUTTON-CODE-BUGS.md` for complete ghost variant code.

**Status:** [ ] Complete

---

## ✅ PHASE 5: Update Component Usage (30 minutes)

### Step 5.1: Replace Custom Icon Buttons in TranscriptTable

**File:** `src/components/transcript-library/TranscriptTable.tsx`

Find all instances of:
```tsx
<button className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex...">
```

Replace with:
```tsx
<Button variant="ghost" size="icon-sm">
```

**Status:** [ ] Complete

### Step 5.2: Fix Pagination Buttons

**File:** `src/components/ui/pagination-controls.tsx`

```tsx
// FROM:
<Button size="icon">
  <ChevronLeft />
</Button>

// TO:
<Button variant="hollow" size="icon">
  <ChevronLeft />
</Button>
```

**Status:** [ ] Complete

### Step 5.3: Find and Replace variant="outline"

```bash
# Find all instances
grep -rn 'variant="outline"' src/

# Replace with hollow
find src -name "*.tsx" -type f -exec sed -i '' 's/variant="outline"/variant="hollow"/g' {} \;
```

**Status:** [ ] Complete

### Step 5.4: Find and Replace variant="secondary"

```bash
# Find all instances
grep -rn 'variant="secondary"' src/

# Replace with hollow
find src -name "*.tsx" -type f -exec sed -i '' 's/variant="secondary"/variant="hollow"/g' {} \;
```

**Status:** [ ] Complete

---

## ✅ PHASE 6: ESLint Enforcement (Optional, 15 minutes)

### Step 6.1: Add Custom ESLint Rules

**File already created:** `.eslintrc-custom-rules.js`

### Step 6.2: Update .eslintrc.cjs

Add at the end:
```javascript
module.exports = {
  // ... existing config
  plugins: ['./eslintrc-custom-rules'],
  rules: {
    'no-inline-colors': 'warn', // Use 'error' to block commits
  },
};
```

**Status:** [ ] Complete

### Step 6.3: Run Linter

```bash
npm run lint
```

**Fix any violations** it finds.

**Status:** [ ] Complete

---

## ✅ PHASE 7: Final Validation (15 minutes)

### Step 7.1: Search for Remaining Issues

```bash
# Should return 0 or very few:
grep -r "hover:bg-cb-ink" src/
grep -r "#111111" src/
grep -r "#F8F8F8" src/
grep -r "bg-\[#" src/
```

**Status:** [ ] Complete

### Step 7.2: Full Browser Test

Test all pages:
- [ ] /library (transcripts page)
- [ ] /settings
- [ ] Any modals/dialogs
- [ ] Light mode
- [ ] Dark mode
- [ ] Mobile responsive

### Step 7.3: Check Console for Errors

Open browser console:
- [ ] No errors
- [ ] No warnings about unknown classes

**Status:** [ ] Complete

---

## ✅ PHASE 8: Commit (5 minutes)

### Step 8.1: Stage Changes

```bash
git add src/index.css
git add scripts/migrate-to-tokens.sh
git add .eslintrc-custom-rules.js
git add src/components/ui/button.tsx
git add src/
```

**Status:** [ ] Complete

### Step 8.2: Commit

```bash
git commit -m "refactor: implement design token system

- Add button-specific tokens to index.css
- Create utility classes for button patterns
- Migrate from inline colors to design tokens
- Fix hover:bg-cb-ink (BLACK → light gray)
- Add ghost variant for transparent icon buttons
- Enforce token usage with ESLint rule

Fixes: Inconsistent button styles, inline color usage
Result: Single source of truth for all colors"
```

**Status:** [ ] Complete

### Step 8.3: Push (if ready)

```bash
git push origin main
```

**Status:** [ ] Complete

---

## 🎯 SUCCESS CRITERIA

After implementation, verify:

### Visual
- [ ] No buttons turn BLACK on hover
- [ ] Pagination buttons have borders
- [ ] Table icon buttons have NO borders
- [ ] All hover states are light gray
- [ ] Dark mode works correctly throughout

### Code
- [ ] Zero `hover:bg-cb-ink` in codebase
- [ ] Zero or minimal inline hex colors
- [ ] All buttons use token classes
- [ ] ESLint passes (no inline color warnings)

### Architecture
- [ ] All colors defined in `index.css`
- [ ] Changes to colors happen in ONE place
- [ ] No more unique inline implementations per component

---

## 🚨 ROLLBACK PLAN

If something breaks:

```bash
# Restore original index.css
cp src/index-BACKUP.css src/index.css

# Undo all changes
git restore src/

# Restart dev server
npm run dev
```

---

## 📚 REFERENCE FILES

- **`DESIGN-TOKEN-SYSTEM.md`** - Complete architecture explanation
- **`BUTTON-CODE-BUGS.md`** - Detailed button.tsx fixes
- **`BUTTON_VARIANTS.md`** - Usage reference for developers
- **`src/index-UPDATED.css`** - New token system
- **`scripts/migrate-to-tokens.sh`** - Automated migration
- **`.eslintrc-custom-rules.js`** - Enforcement rules

---

## ⏱️ TIME BREAKDOWN

- Phase 1 (Setup): 30 min
- Phase 2 (Migration): 15 min
- Phase 3 (Visual Test): 30 min
- Phase 4 (Button Component): 30 min
- Phase 5 (Component Usage): 30 min
- Phase 6 (ESLint): 15 min
- Phase 7 (Validation): 15 min
- Phase 8 (Commit): 5 min

**Total: 2 hours 50 minutes**

---

## 💡 TIPS

1. **Do visual testing FIRST** - See the problems before fixing
2. **Keep dev server running** - See changes in real-time
3. **Git commit after each phase** - Easy rollback if needed
4. **Test dark mode immediately** - Don't wait until the end
5. **Use browser devtools** - Inspect element to verify tokens loaded

---

**Ready to start? Begin with Phase 1, Step 1.1 above!**
