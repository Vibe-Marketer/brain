---
description: Analyze UI components for consistency with brand guidelines, Radix usage, primitives, and styling
argument-hint: <feature path, component path, or directory>
allowed-tools: Read, Grep, Glob, Write, Bash
thinking: auto
---

# UI Consistency Review

**Review scope**: $ARGUMENTS

## Process

### Step 1: Load Standards
Read `BRAND_GUIDELINES.md` - This is the single source of truth for all UI rules, patterns, and design standards.

### Step 2: Find Files
Glob all `.tsx` files in the provided path.

### Step 3: Run Automated Scans

Execute scans for common violations:

**Critical (must fix):**
- Vibe green misuse (used outside 5 approved patterns)
- Wrong button variants (not using primary/hollow/destructive/link)
- Typography violations (wrong font family for headings vs body)

**High priority:**
- Dark mode issues (primary/destructive buttons changing colors)
- Missing focus states (no vibe green ring)
- Layout violations (cards where white background should be used)

**Medium priority:**
- Spacing not on 4px grid
- Missing tabular-nums on number columns
- Table design violations

### Step 4: Deep Analysis

For each file, check against BRAND_GUIDELINES.md sections:

1. **Color Usage** - Vibe green only for 5 approved uses
2. **Button System** - Only 4 variants (primary/hollow/destructive/link)
3. **Typography** - Montserrat for headings (caps), Inter for body
4. **Layout** - 90% rule (no cards), gutters, spacing
5. **Tables** - Header styling, borders, row heights
6. **Dark Mode** - Correct color adaptations
7. **Accessibility** - Focus states, touch targets

### Step 5: Generate Report

Save to `docs/reviews/ui-consistency-review-[feature].md` with:

- Overall compliance score
- Component-by-component analysis
- Violations with file:line, current code, required fix
- Prioritized action items

### Step 6: Create Action Items

If violations found, provide:

- Specific fixes with code examples
- Reference to BRAND_GUIDELINES.md section violated
- Priority order for fixes

---

**Note**: Reference BRAND_GUIDELINES.md section names when citing violations. Do not duplicate the full rules in the report.
