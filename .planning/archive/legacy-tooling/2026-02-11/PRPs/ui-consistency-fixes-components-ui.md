# PRP: UI Consistency Fixes - Component Library

**Project Requirements Plan v1.0 - Refactoring**

---

## Goal

**Feature Goal**: Resolve all UI consistency violations identified in audit to achieve 100% compliance with UI_STANDARDS.md and brand-guidelines-v3.3.md

**Deliverable**:

- 2 immediate fixes (dark mode variant, responsive grid)
- 9 high-priority layout fixes (flex-1 + min-w-0)
- 10 medium-priority refactors (long className split)
- 1 enhancement (Button type="button" default)

**Success Definition**:

- All automated scans from UI_STANDARDS.md return zero violations
- Components pass design-review agent validation
- Grade improves from A- (8.5/10) to A+ (10/10)

## Why

- **Current State**: A- grade (8.5/10) with 25 total violations across 53 components
- **Risk**: Layout issues (flex-1 without min-w-0) can cause horizontal page expansion
- **Maintainability**: Long className strings (536 chars in command.tsx!) are unreadable
- **Accessibility**: Missing dark mode variants break user experience in dark theme
- **Standards Compliance**: UI_STANDARDS.md violations accumulate technical debt

**Business Impact**:

- Dark mode users see broken mac-os-dock component
- Mobile users see broken date-picker grid layout
- Developers struggle with 536-character className strings
- Future UI changes risk introducing same patterns

## What

User-visible behavior changes:

- mac-os-dock displays correctly in dark mode
- date-range-picker quick select buttons stack properly on mobile
- No visual changes to other components (internal refactoring only)

Technical requirements:

- Add dark mode variant to 1 component
- Add responsive breakpoints to 1 grid
- Add min-w-0 constraint to 9 flex containers
- Split 10 long className strings into readable arrays
- Add type="button" default to Button component

### Success Criteria

- [ ] All automated scans from UI_STANDARDS.md pass with zero violations
- [ ] Design-review agent validates all changed components
- [ ] TypeScript compilation passes: `npx tsc --noEmit`
- [ ] No visual regressions (compare screenshots before/after)
- [ ] Documentation updated with new patterns

## All Needed Context

### Context Completeness Check

✅ **Passes "No Prior Knowledge" test**: This PRP includes exact file locations, line numbers, before/after code, validation commands, and complete context from audit report.

### Documentation & References

```yaml
# MUST READ - Critical Standards
- file: docs/ai_docs/UI_STANDARDS.md
  why: Complete UI implementation patterns and automated scan reference
  section: All 8 sections (Tailwind V4, Layout/Responsive, Theming, Radix UI, Primitives, A11y, TypeScript, Functional Logic)
  critical: "AUTOMATED SCAN REFERENCE section (lines 662-695) contains validation commands"

- file: docs/brand-guidelines-v3.3.md
  why: Visual design specifications and brand tokens
  section: "Color Usage Rules, Button System, Typography Rules, Layout Rules"
  critical: "Dark mode tokens: bg-white dark:bg-black pattern, cb-* semantic tokens"

- file: PRPs/reviews/ui-consistency-review-components-ui.md
  why: Comprehensive audit report with exact violations, line numbers, fixes
  section: "Detailed Findings by Component (lines 33-158), Prioritized Action Items (lines 215-252)"
  critical: "Before/after code examples for every fix, organized by priority"

# Pattern Reference Files
- file: src/components/ui/button.tsx
  why: Example of correct brand guidelines implementation (100% compliant)
  pattern: "4 variants (default, destructive, hollow, link), proper sizing, glossy gradients, vibe green focus"
  gotcha: "Missing type='button' default prop - add this as enhancement"

- file: src/components/ui/tabs.tsx
  why: Example of enforced styling (classes after className prop)
  pattern: "Enforced classes prevent override: justify-start gap-6 placed AFTER className"
  gotcha: "6px vibe green underline uses ::after pseudo-element, clip-path in global CSS"

# External References
- url: https://tailwindcss.com/docs/responsive-design#mobile-first
  why: Responsive design breakpoints (sm, md, lg, xl)
  critical: "Mobile-first approach: base styles apply to mobile, use md:, lg: for desktop"

- url: https://www.radix-ui.com/primitives/docs/components/dropdown-menu
  why: DropdownMenuItem handles keyboard/accessibility (validates top-bar.tsx is OK)
  critical: "Radix primitives provide built-in keyboard support, no button wrapper needed"
```

### Current Codebase Tree (relevant sections)

```bash
src/components/ui/
├── button.tsx               # ✅ EXCELLENT - Use as reference
├── tabs.tsx                 # ✅ EXCELLENT - Use as reference
├── badge.tsx                # ✅ GOOD - Semantic variants
├── mac-os-dock.tsx          # ⚠️ IMMEDIATE FIX - Missing dark mode
├── date-range-picker.tsx    # ⚠️ IMMEDIATE FIX - Non-responsive grid
├── transcript-table-skeleton.tsx  # ⚠️ HIGH - Missing min-w-0
├── progress.tsx             # ⚠️ HIGH - Missing min-w-0
├── chart.tsx                # ⚠️ HIGH - Missing min-w-0
├── scroll-area.tsx          # ⚠️ HIGH - Missing min-w-0
├── accordion.tsx            # ⚠️ HIGH - Missing min-w-0
├── intel-card.tsx           # ⚠️ HIGH - Missing min-w-0
├── sidebar.tsx              # ⚠️ HIGH - Missing min-w-0 (3 instances)
├── command.tsx              # ⚠️ MEDIUM - 536 char className!
├── slider.tsx               # ⚠️ MEDIUM - 217 char className
├── sheet.tsx                # ⚠️ MEDIUM - 240 char className
└── ... (43 other components - no violations)

docs/ai_docs/UI_STANDARDS.md       # Complete reference
docs/brand-guidelines-v3.3.md   # Visual specifications
PRPs/reviews/ui-consistency-review-components-ui.md  # Audit report
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Radix UI primitives handle accessibility
// DropdownMenuItem, SelectItem, etc. have built-in keyboard support
// DO NOT wrap in <button> tags - they handle role/tabIndex/keyboard internally

// CRITICAL: flex-1 + overflow-x-auto causes page expansion
// Pattern: Parent with overflow child MUST have min-w-0
<div className="flex gap-6">
  <main className="flex-1 min-w-0">  {/* min-w-0 REQUIRED */}
    <div className="overflow-x-auto">...</div>
  </main>
</div>

// CRITICAL: Dark mode pattern consistency
// Always use: bg-white dark:bg-black (semantic tokens)
// NEVER: bg-white only (breaks dark mode)

// CRITICAL: Responsive grid pattern
// Mobile-first: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
// NEVER: grid-cols-3 (breaks mobile)

// CRITICAL: Long className splitting
// Split into array for readability:
const classes = [
  "base-styles",
  "state-styles",
  "responsive-styles",
].join(" ");

// CRITICAL: Button type="button" prevents form submission
// Default <button> is type="submit" which triggers form submission
// type="button" prevents this - should be default for UI buttons
```

## Implementation Blueprint

### Data Models (N/A - No new data structures)

This is a refactoring task operating on existing components with no data model changes.

### Implementation Tasks (ordered by priority and dependencies)

```yaml
# ========================================
# PHASE 1: IMMEDIATE FIXES (Blocking Issues)
# ========================================

Task 1: FIX mac-os-dock.tsx dark mode variant
  - FILE: src/components/ui/mac-os-dock.tsx
  - LINE: 49
  - CHANGE:
      BEFORE: "bg-white/30 backdrop-blur-md",
      AFTER: "bg-white/30 dark:bg-black/30 backdrop-blur-md",
  - WHY: Component broken in dark mode (white blob visible)
  - VALIDATION: Open in dark mode, verify translucent dark background
  - PATTERN: Standard dark mode token usage from brand-guidelines-v3.3.md

Task 2: FIX date-range-picker.tsx non-responsive grid
  - FILE: src/components/ui/date-range-picker.tsx
  - LINE: 144
  - CHANGE:
      BEFORE: <div className="grid grid-cols-3 gap-2">
      AFTER: <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
  - WHY: Quick select buttons overflow on mobile (< 640px)
  - VALIDATION: Test at 375px, 640px, 768px widths
  - PATTERN: Mobile-first responsive design from Tailwind docs

# ========================================
# PHASE 2: HIGH-PRIORITY LAYOUT FIXES
# ========================================

Task 3: ADD min-w-0 to flex-1 containers (9 files)
  - STRATEGY: Only add min-w-0 if flex container has overflow-x-auto descendants
  - VALIDATION FIRST: Manually verify each instance needs the constraint

  Instance 1: transcript-table-skeleton.tsx:20
    - CURRENT: <div className="flex-1 space-y-2">
    - AFTER: <div className="flex-1 min-w-0 space-y-2">
    - VERIFY: Check if parent contains overflow-x-auto (line 37 shows it does)
    - WHY: Prevents horizontal page expansion with table overflow

  Instance 2: progress.tsx:16
    - CURRENT: className="h-full w-full flex-1 bg-cb-green ..."
    - DECISION: Skip - already has w-full which constrains width
    - WHY: w-full provides width constraint, min-w-0 redundant

  Instance 3: chart.tsx:202
    - CURRENT: "flex flex-1 justify-between leading-none"
    - DECISION: Skip - no overflow-x-auto descendants in ChartTooltipContent
    - WHY: No overflow risk, min-w-0 not needed

  Instance 4: scroll-area.tsx:33
    - CURRENT: className="relative flex-1 rounded-full bg-border"
    - DECISION: Skip - ScrollAreaThumb is intrinsically sized element
    - WHY: Radix ScrollAreaThumb handles its own constraints

  Instance 5: accordion.tsx:25
    - CURRENT: "flex flex-1 items-center justify-between ..."
    - DECISION: Skip - AccordionTrigger has no overflow children
    - WHY: Text content only, no horizontal scroll risk

  Instance 6: intel-card.tsx:102
    - CURRENT: <div className="flex items-center gap-2 flex-1">
    - AFTER: <div className="flex items-center gap-2 flex-1 min-w-0">
    - VERIFY: Contains text that should truncate, not overflow
    - WHY: Allows text truncation within flex container

  Instance 7-9: sidebar.tsx (3 instances at lines 255, 312, 526)
    - Line 255: <main className="relative flex min-h-svh flex-1 flex-col bg-background">
      - DECISION: Skip - no horizontal scroll risk in vertical flex
    - Line 312: className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto ..."
      - DECISION: Skip - already has min-h-0 and overflow-auto (not overflow-x-auto)
    - Line 526: className="h-4 max-w-[--skeleton-width] flex-1"
      - DECISION: Skip - already has max-w constraint

  - FINAL COUNT: Only 2 instances actually need min-w-0 (transcript-table-skeleton, intel-card)
  - VALIDATION: Test horizontal scroll behavior after changes

# ========================================
# PHASE 3: MEDIUM-PRIORITY REFACTORS
# ========================================

Task 4: SPLIT long className strings (10 files, prioritize by length)
  - PATTERN: Use array.join(" ") for lines > 120 chars
  - ORDER: Tackle longest first (command.tsx 536 chars!)

  4a. command.tsx:30 (536 characters - EXTREME)
    - BEFORE: className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium..."
    - AFTER:
      className={[
        // Group heading styles
        "[&_[cmdk-group-heading]]:px-2",
        "[&_[cmdk-group-heading]]:font-medium",
        "[&_[cmdk-group-heading]]:text-muted-foreground",
        // Group spacing
        "[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0",
        "[&_[cmdk-group]]:px-2",
        // Input wrapper styles
        "[&_[cmdk-input-wrapper]_svg]:h-5",
        "[&_[cmdk-input-wrapper]_svg]:w-5",
        "[&_[cmdk-input]]:h-12",
        // Item styles
        "[&_[cmdk-item]]:px-2",
        "[&_[cmdk-item]]:py-3",
        "[&_[cmdk-item]_svg]:h-5",
        "[&_[cmdk-item]_svg]:w-5",
      ].join(" ")}
    - WHY: 536 char line is completely unreadable, impossible to maintain

  4b. intel-card.tsx:117 (335 characters)
    - SPLIT: Quote toggle section with clear semantic grouping
    - PATTERN: Group by functionality (layout, interactivity, styling)

  4c. intel-card.tsx:120 (284 characters)
    - SPLIT: Agent info section with semantic grouping

  4d. sheet.tsx:60 (240 characters)
    - SPLIT: SheetClose button with state/interaction groups

  4e. slider.tsx:18 (217 characters)
    - SPLIT: SliderThumb with clear groups (size, border, background, transitions, states)

  4f-j. Remaining 5 files (floating-window, accordion, alert-dialog, progress)
    - SPLIT: Follow same pattern, group by semantic meaning

  - VALIDATION: Verify compiled output is identical (className behavior unchanged)
  - PATTERN REFERENCE: See command.tsx refactor as template for others

# ========================================
# PHASE 4: ENHANCEMENT (Non-Critical)
# ========================================

Task 5: ADD type="button" default to Button component
  - FILE: src/components/ui/button.tsx
  - LINE: 88-90 (Button component signature)
  - CHANGE:
      BEFORE: ({ className, variant = "default", size = "default", asChild = false, ...props }, ref)
      AFTER: ({ className, variant = "default", size = "default", type = "button", asChild = false, ...props }, ref)
  - WHY: Prevents accidental form submission when button used inside <form>
  - PATTERN: Default <button> is type="submit" which triggers form submission
  - GOTCHA: For submit buttons, users must explicitly pass type="submit"
  - VALIDATION: Test button inside form, verify doesn't submit by default

# ========================================
# PHASE 5: DOCUMENTATION
# ========================================

Task 6: UPDATE UI_STANDARDS.md with patterns from fixes
  - ADD: Example of array.join() pattern for long classNames (Section 7)
  - ADD: flex-1 + min-w-0 decision tree (Section 2)
  - ADD: Button type="button" to Anti-Patterns section
  - WHY: Prevent future developers from reintroducing same issues
  - VALIDATION: Review addition with team, ensure clarity
```

### Implementation Patterns & Key Details

```typescript
// =============================================
// PATTERN 1: Dark Mode Variant (mac-os-dock.tsx)
// =============================================

// BEFORE (broken in dark mode)
className={cn(
  "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
  "flex items-end gap-2 px-3 py-2",
  "bg-white/30 backdrop-blur-md",  // ❌ No dark variant
  "border border-border rounded-2xl shadow-2xl",
  className,
)}

// AFTER (works in both modes)
className={cn(
  "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
  "flex items-end gap-2 px-3 py-2",
  "bg-white/30 dark:bg-black/30 backdrop-blur-md",  // ✅ Both modes
  "border border-border rounded-2xl shadow-2xl",
  className,
)}

// =============================================
// PATTERN 2: Responsive Grid (date-range-picker.tsx)
// =============================================

// BEFORE (breaks on mobile < 640px)
<div className="grid grid-cols-3 gap-2">
  <Button variant="hollow" size="sm" ...>Today</Button>
  <Button variant="hollow" size="sm" ...>Yesterday</Button>
  <Button variant="hollow" size="sm" ...>Last 7 Days</Button>
</div>

// AFTER (mobile-first responsive)
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
  <Button variant="hollow" size="sm" ...>Today</Button>
  <Button variant="hollow" size="sm" ...>Yesterday</Button>
  <Button variant="hollow" size="sm" ...>Last 7 Days</Button>
</div>
// Result: 1 column on mobile, 2 on small screens, 3 on medium+

// =============================================
// PATTERN 3: flex-1 + min-w-0 (transcript-table-skeleton.tsx)
// =============================================

// CONTEXT: flex-1 in parent of overflow-x-auto causes page expansion
<tr>
  <td>
    {/* ❌ BEFORE: flex-1 without min-w-0 */}
    <div className="flex-1 space-y-2">
      <div className="overflow-x-auto">
        <table>...</table>
      </div>
    </div>
  </td>
</tr>

<tr>
  <td>
    {/* ✅ AFTER: min-w-0 allows flex to shrink below content size */}
    <div className="flex-1 min-w-0 space-y-2">
      <div className="overflow-x-auto">
        <table>...</table>
      </div>
    </div>
  </td>
</tr>

// WHY: Without min-w-0, flex-1 expands to fit child content, causing horizontal page scroll
// WITH min-w-0: Flex can shrink below content size, overflow-x-auto handles internal scroll

// =============================================
// PATTERN 4: Long className Split (command.tsx)
// =============================================

// BEFORE (536 characters - UNREADABLE)
<Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">

// AFTER (readable, maintainable, same compiled output)
<Command
  className={[
    // Group heading styles
    "[&_[cmdk-group-heading]]:px-2",
    "[&_[cmdk-group-heading]]:font-medium",
    "[&_[cmdk-group-heading]]:text-muted-foreground",
    // Group spacing
    "[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0",
    "[&_[cmdk-group]]:px-2",
    // Input wrapper styles
    "[&_[cmdk-input-wrapper]_svg]:h-5",
    "[&_[cmdk-input-wrapper]_svg]:w-5",
    "[&_[cmdk-input]]:h-12",
    // Item styles
    "[&_[cmdk-item]]:px-2",
    "[&_[cmdk-item]]:py-3",
    "[&_[cmdk-item]_svg]:h-5",
    "[&_[cmdk-item]_svg]:w-5",
  ].join(" ")}
>

// BENEFITS:
// - Each style on own line (readable)
// - Comments group related styles (maintainable)
// - Git diffs show exact line changed (reviewable)
// - Compiled output identical (no runtime impact)

// =============================================
// PATTERN 5: Button type="button" Default
// =============================================

// CONTEXT: Default <button> is type="submit" which submits forms
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = "default",
    size = "default",
    type = "button",  // ✅ ADD THIS - prevents accidental form submission
    asChild = false,
    ...props
  }, ref) => {

    // For submit buttons, users must explicitly pass type="submit":
    // <Button type="submit">Submit Form</Button>

    // For regular UI buttons, type="button" is now default:
    // <Button onClick={handleClick}>Click Me</Button>

    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} type={type} {...props} />;
  }
);
```

### Integration Points

```yaml
VALIDATION:
  - script: npm run lint
    expected: "Zero errors"
  - script: npx tsc --noEmit
    expected: "No type errors"
  - script: npm run dev
    test: "Visual regression testing"

UI_STANDARDS:
  - file: docs/ai_docs/UI_STANDARDS.md
    sections_updated:
      - "Section 2: Layout & Responsive - Add flex-1 decision tree"
      - "Section 7: TypeScript - Add array.join() pattern"
      - "Anti-Patterns - Add Button type prop"

DESIGN_REVIEW:
  - agent: design-review-agent
    scope: "All changed components"
    validation: "No visual regressions, dark mode works"
```

## Validation Loop

### Level 1: Syntax & Style (After Each File)

```bash
# Run after each component edit
npx tsc --noEmit --pretty src/components/ui/{component}.tsx
npm run lint src/components/ui/{component}.tsx

# Expected: Zero errors. If errors, fix before next file.

# Full suite after phase complete
npx tsc --noEmit
npm run lint

# Expected: Zero errors across all 53 components
```

### Level 2: Automated Scans (After Each Phase)

```bash
# ===== PHASE 1 VALIDATION: Immediate Fixes =====
# Should return ZERO results after fixes

# Dark mode check (mac-os-dock)
grep -rn "bg-white\|bg-black" src/components/ui/mac-os-dock.tsx | grep -v "dark:"
# Expected: Empty (all have dark variants)

# Non-responsive grid check (date-range-picker)
grep -rn "grid-cols-[2-9]" src/components/ui/date-range-picker.tsx | grep -v "md:\|lg:"
# Expected: Empty (all responsive)

# ===== PHASE 2 VALIDATION: Layout Fixes =====

# flex-1 without min-w-0 check
grep -rn "flex-1" src/components/ui --include="*.tsx" | grep -v "min-w-0" | wc -l
# Expected: 7 (down from 9, only transcript-table-skeleton and intel-card actually need it)

# ===== PHASE 3 VALIDATION: Refactors =====

# Long className check
grep -rn ".\{121,\}" src/components/ui --include="*.tsx" | grep className | wc -l
# Expected: 0 (down from 10)

# ===== FULL SUITE VALIDATION =====

# Run ALL scans from UI_STANDARDS.md AUTOMATED SCAN REFERENCE section
# Critical scans
grep -rn "className.*\`.*\${.*}\`\|bg-\${.*}\|ring-\${.*}" src/components/ui --include="*.tsx"
grep -rn "grid-cols-[2-9]" src/components/ui --include="*.tsx" | grep -v "md:\|lg:\|xl:"
grep -rn "<select>\|type=\"checkbox\"\|type=\"radio\"" src/components/ui --include="*.tsx"
grep -rn "emerald" src/components/ui --include="*.tsx"

# High priority scans
grep -rn "bg-white\|bg-black" src/components/ui --include="*.tsx" | grep -v "dark:"
grep -rn "backdrop-blur.*bg-white/.*border" src/components/ui --include="*.tsx"

# Expected: ALL return zero results (A+ grade achieved)
```

### Level 3: Visual Regression Testing

```bash
# Start dev server
npm run dev &
SERVER_PID=$!
sleep 5  # Allow startup

# Manual visual testing checklist:
# 1. mac-os-dock in dark mode (should be dark translucent, not white)
# 2. date-range-picker at 375px width (buttons should stack vertically)
# 3. Verify no layout shifts in components with flex-1 changes
# 4. Verify Button type="button" doesn't break existing forms

# Use design-review agent for comprehensive validation
/design-review

# Expected: No visual regressions, dark mode works correctly

# Cleanup
kill $SERVER_PID
```

### Level 4: Design Review Agent Validation

```bash
# Run comprehensive design review on changed components
/design-review

# Validates:
# - Dark mode variants work correctly
# - Responsive layouts at 1440px, 768px, 375px
# - WCAG AA accessibility compliance
# - No visual regressions vs baseline screenshots
# - Brand guidelines compliance

# Expected:
# - All phases pass validation
# - Grade: A+ (10/10)
# - Zero blockers, zero high-priority issues
```

## Final Validation Checklist

### Technical Validation

- [ ] All automated scans pass with zero violations
- [ ] TypeScript compilation: `npx tsc --noEmit` - zero errors
- [ ] Linting: `npm run lint` - zero errors
- [ ] Production build: `npm run build` - success

### Feature Validation

- [ ] mac-os-dock displays correctly in dark mode (translucent dark background)
- [ ] date-range-picker grid responsive at 375px, 640px, 768px, 1440px
- [ ] No horizontal page expansion with flex-1 components
- [ ] All className strings under 120 characters
- [ ] Button type="button" prevents accidental form submission
- [ ] Button type="submit" still works when explicitly set

### Code Quality Validation

- [ ] Follows UI_STANDARDS.md patterns (Section 1-8)
- [ ] Follows brand-guidelines-v3.3.md specifications
- [ ] Array.join() pattern used for all long className strings
- [ ] Dark mode tokens consistent: bg-white dark:bg-black
- [ ] Comments added to complex className arrays
- [ ] Git diff readable (one style per line changes)

### Design Review Validation

- [ ] design-review agent passes all changed components
- [ ] No visual regressions vs pre-fix screenshots
- [ ] Dark mode works across all themes
- [ ] Responsive breakpoints work correctly
- [ ] WCAG AA accessibility maintained

### Documentation Updates

- [ ] UI_STANDARDS.md updated with new patterns
- [ ] Audit report marked as implemented
- [ ] Changelog entry added with fix summary

---

## Anti-Patterns to Avoid

### ❌ DON'T: Add min-w-0 to every flex-1

**WHY**: Only needed when parent contains overflow-x-auto descendants
**DO**: Use decision tree - verify overflow risk before adding

### ❌ DON'T: Split className just to hit 120 char limit

**WHY**: Over 150+ chars benefits from splitting, not 121 chars
**DO**: Split when truly unreadable (200+ chars) or semantically groupable

### ❌ DON'T: Change visual behavior during refactoring

**WHY**: This is code cleanup, not redesign
**DO**: Verify compiled output and visual appearance unchanged

### ❌ DON'T: Skip validation between phases

**WHY**: Catch regressions early, don't compound errors
**DO**: Run automated scans after every phase completion

### ❌ DON'T: Add dark mode variants to overlays (bg-black/80)

**WHY**: Overlays intentionally use black for dimming effect
**DO**: Only add dark variants to component backgrounds, not overlay dims

### ❌ DON'T: Remove type="button" from existing submit buttons

**WHY**: Breaking change for form submissions
**DO**: Only add type="button" as default, allow type="submit" override

---

## Confidence Score: 9.5/10

**Why High Confidence:**

- ✅ Exact file locations and line numbers provided
- ✅ Before/after code for every change
- ✅ Comprehensive validation commands
- ✅ Clear patterns from existing code
- ✅ No external API dependencies
- ✅ No new features, only fixes to existing code
- ✅ Extensive documentation and standards reference

**Why Not 10/10:**

- ⚠️ Visual regression testing requires manual review
- ⚠️ flex-1 + min-w-0 decision requires judgment (provided decision tree)
- ⚠️ Button type="button" could break edge cases (validated via testing)

**One-Pass Implementation Likelihood: VERY HIGH**

This PRP provides complete context for an AI agent to implement all fixes successfully in a single pass with zero ambiguity.
