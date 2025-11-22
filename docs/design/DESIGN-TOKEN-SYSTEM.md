# DESIGN TOKEN SYSTEM - Single Source of Truth

**Generated:** 2025-11-20
**Problem:** Inline colors everywhere instead of using centralized tokens
**Solution:** Complete token system + enforcement

---

## 🎯 THE ROOT CAUSE

**You already HAVE a token system defined:**
- ✅ `src/index.css` defines CSS variables
- ✅ `tailwind.config.ts` maps them to Tailwind

**But developers are NOT using it:**
- ❌ Using `#111111` inline instead of `bg-cb-ink`
- ❌ Using `#F8F8F8` inline instead of `bg-cb-hover`
- ❌ Using `#202020` inline instead of `dark:bg-[#202020]` (should be `dark:bg-card`)
- ❌ Creating unique implementations per component

**Result:** Change requires editing 50 files instead of 1 token.

---

## 📋 CURRENT TOKEN SYSTEM (Already Defined)

### From `src/index.css`:

```css
:root {
  /* Backgrounds */
  --cb-white: 0 0% 100%;        /* #FFFFFF */
  --cb-hover: 0 0% 97%;         /* #F8F8F8 - Light gray hover */
  --cb-card-dark: 0 0% 13%;     /* #202020 - Dark card bg */
  --cb-panel-dark: 0 0% 16%;    /* #2A2A2A - Dark panel bg */

  /* Text */
  --cb-ink: 210 17% 7%;         /* #111111 - Primary text */
  --cb-ink-soft: 0 0% 27%;      /* #444444 - Secondary text */
  --cb-ink-muted: 0 0% 48%;     /* #7A7A7A - Icons */

  /* Borders */
  --cb-border: 0 0% 90%;        /* #E5E5E5 */
  --cb-border-dark: 0 0% 23%;   /* #3A3A3A */

  /* Vibe Green */
  --vibe-green: 72 96% 70%;     /* #D9FC67 */
}
```

### Mapped to Tailwind (from `tailwind.config.ts`):

```typescript
cb: {
  white: "hsl(var(--cb-white))",           // bg-cb-white
  ink: "hsl(var(--cb-ink))",               // text-cb-ink
  hover: "hsl(var(--cb-hover))",           // bg-cb-hover
  border: "hsl(var(--cb-border))",         // border-cb-border
  // ... etc
}
```

---

## 🐛 THE PROBLEM: Inline Usage Everywhere

### Bad Examples (Current Code):

```tsx
// ❌ BAD: Inline hex color
className="hover:bg-cb-ink"  // ← This is #111111 (BLACK)

// ❌ BAD: Inline hex in dark mode
className="dark:bg-[#202020]"  // ← Should use token

// ❌ BAD: Custom inline styles
style={{ background: '#111111' }}

// ❌ BAD: Using wrong token
className="bg-cb-ink"  // ← This is BLACK, not white!
```

### Good Examples (What It Should Be):

```tsx
// ✅ GOOD: Using hover token
className="hover:bg-cb-hover"  // Light gray

// ✅ GOOD: Using dark mode card token
className="dark:bg-card"  // #202020 via token

// ✅ GOOD: Using semantic token
className="bg-white dark:bg-card"

// ✅ GOOD: Using border token
className="border border-cb-border dark:border-cb-border-dark"
```

---

## 🔧 THE SOLUTION: Complete + Enforce

### Step 1: Add Missing Button Tokens

**Add to `src/index.css` after line 37:**

```css
/* ============================================
   BUTTON SYSTEM TOKENS
   ============================================ */

/* Button Backgrounds */
--btn-bg-primary: linear-gradient(160deg, hsl(210 17% 40%) 0%, hsl(210 17% 25%) 100%);  /* Slate gradient */
--btn-bg-destructive: linear-gradient(160deg, hsl(0 74% 58%) 0%, hsl(0 74% 44%) 100%);  /* Red gradient */
--btn-bg-hollow-light: 0 0% 100%;     /* #FFFFFF */
--btn-bg-hollow-dark: 0 0% 13%;       /* #202020 */
--btn-bg-ghost: transparent;          /* Transparent */

/* Button Hover States */
--btn-hover-hollow: 0 0% 97%;         /* #F8F8F8 - Light gray */
--btn-hover-hollow-dark: 0 0% 16%;    /* #2A2A2A - Dark gray */
--btn-hover-ghost: 0 0% 96%;          /* rgba(0,0,0,0.05) equivalent */
--btn-hover-ghost-dark: 0 0% 20%;     /* rgba(255,255,255,0.05) equivalent */

/* Button Borders */
--btn-border-light: 0 0% 90%;         /* #E5E5E5 */
--btn-border-dark: 0 0% 23%;          /* #3A3A3A */
--btn-border-hollow: var(--cb-border);
--btn-border-hollow-dark: var(--cb-border-dark);

/* Button Text */
--btn-text-primary: 0 0% 100%;        /* White */
--btn-text-hollow-light: 210 17% 7%;  /* cb-ink */
--btn-text-hollow-dark: 0 0% 100%;    /* White */

/* Button Focus Ring */
--btn-focus-ring: var(--vibe-green);  /* Always vibe green */
```

### Step 2: Map to Tailwind

**Add to `tailwind.config.ts` in `colors` section (around line 135):**

```typescript
button: {
  // Backgrounds
  'bg-primary': 'linear-gradient(160deg, hsl(210, 17%, 40%), hsl(210, 17%, 25%))',
  'bg-destructive': 'linear-gradient(160deg, hsl(0, 74%, 58%), hsl(0, 74%, 44%))',
  'bg-hollow': {
    DEFAULT: 'hsl(var(--btn-bg-hollow-light))',
    dark: 'hsl(var(--btn-bg-hollow-dark))',
  },
  'bg-ghost': 'transparent',

  // Hover states
  'hover-hollow': {
    DEFAULT: 'hsl(var(--btn-hover-hollow))',
    dark: 'hsl(var(--btn-hover-hollow-dark))',
  },
  'hover-ghost': {
    DEFAULT: 'hsl(var(--btn-hover-ghost))',
    dark: 'hsl(var(--btn-hover-ghost-dark))',
  },

  // Borders
  border: {
    DEFAULT: 'hsl(var(--btn-border-light))',
    dark: 'hsl(var(--btn-border-dark))',
  },

  // Text
  text: {
    primary: 'hsl(var(--btn-text-primary))',
    hollow: {
      DEFAULT: 'hsl(var(--btn-text-hollow-light))',
      dark: 'hsl(var(--btn-text-hollow-dark))',
    },
  },

  // Focus
  focus: 'hsl(var(--vibe-green))',
},
```

### Step 3: Create Utility Classes

**Add to `src/index.css` at bottom:**

```css
@layer components {
  /* ============================================
     BUTTON UTILITY CLASSES
     Enforces token usage
     ============================================ */

  .btn-base {
    @apply inline-flex items-center justify-center rounded-md transition-colors;
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-green focus-visible:ring-offset-2;
    @apply disabled:pointer-events-none disabled:opacity-50;
  }

  .btn-hollow {
    @apply btn-base;
    @apply border border-cb-border dark:border-cb-border-dark;
    @apply bg-white dark:bg-card;
    @apply text-cb-ink dark:text-white;
    @apply hover:bg-cb-hover dark:hover:bg-cb-panel-dark;
  }

  .btn-ghost {
    @apply btn-base;
    @apply hover:bg-muted/50;
  }

  .btn-icon {
    @apply p-0;
    @apply [&_svg]:pointer-events-none [&_svg]:shrink-0;
  }

  .btn-icon-sm {
    @apply h-5 w-5 md:h-6 md:w-6;
    @apply [&_svg]:h-3 [&_svg]:w-3 md:[&_svg]:h-3.5 md:[&_svg]:w-3.5;
  }

  .btn-icon-md {
    @apply h-8 w-8;
    @apply [&_svg]:h-4 [&_svg]:w-4;
  }
}
```

---

## 🔒 ENFORCE TOKEN USAGE

### Step 4: ESLint Rule to Ban Inline Colors

**Create `.eslintrc-custom-rules.js`:**

```javascript
module.exports = {
  rules: {
    'no-inline-colors': {
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name.name === 'className') {
              const value = node.value?.value || '';

              // Ban inline hex colors
              if (value.includes('#')) {
                context.report({
                  node,
                  message: '🚫 No inline hex colors! Use design tokens instead (bg-cb-white, text-cb-ink, etc.)',
                });
              }

              // Ban specific wrong classes
              const bannedClasses = [
                { pattern: /hover:bg-cb-ink/, correct: 'hover:bg-cb-hover' },
                { pattern: /bg-\[#[0-9A-F]{6}\]/i, correct: 'Use token: bg-cb-white, bg-card, etc.' },
                { pattern: /dark:bg-\[#[0-9A-F]{6}\]/i, correct: 'Use token: dark:bg-card, dark:bg-cb-panel-dark' },
              ];

              bannedClasses.forEach(({ pattern, correct }) => {
                if (pattern.test(value)) {
                  context.report({
                    node,
                    message: `🚫 Don't use inline colors! Use: ${correct}`,
                  });
                }
              });
            }

            // Ban inline styles with colors
            if (node.name.name === 'style') {
              context.report({
                node,
                message: '🚫 No inline styles with colors! Use Tailwind tokens instead.',
              });
            }
          },
        };
      },
    },
  },
};
```

**Add to `.eslintrc.cjs`:**

```javascript
module.exports = {
  // ... existing config
  plugins: ['./eslintrc-custom-rules'],
  rules: {
    'no-inline-colors': 'error',
  },
};
```

### Step 5: Type-Safe Token System (Optional)

**Create `src/lib/design-tokens.ts`:**

```typescript
/**
 * Design Token System - Type-safe token usage
 * Use these constants instead of inline values
 */

export const COLORS = {
  // Backgrounds
  BG_WHITE: 'bg-white',
  BG_CARD: 'bg-card',
  BG_HOVER: 'bg-cb-hover',
  BG_PANEL_DARK: 'bg-cb-panel-dark',

  // Text
  TEXT_PRIMARY: 'text-cb-ink dark:text-white',
  TEXT_SECONDARY: 'text-cb-ink-soft dark:text-cb-text-dark-secondary',
  TEXT_MUTED: 'text-cb-ink-muted dark:text-cb-text-dark-muted',

  // Borders
  BORDER: 'border-cb-border dark:border-cb-border-dark',

  // Hover States
  HOVER_LIGHT_GRAY: 'hover:bg-cb-hover dark:hover:bg-cb-panel-dark',
  HOVER_GHOST: 'hover:bg-muted/50',
} as const;

export const BUTTON_CLASSES = {
  BASE: 'inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-green focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',

  HOLLOW: 'border border-cb-border dark:border-cb-border-dark bg-white dark:bg-card text-cb-ink dark:text-white hover:bg-cb-hover dark:hover:bg-cb-panel-dark',

  GHOST: 'hover:bg-muted/50',

  ICON_SM: 'h-5 w-5 md:h-6 md:w-6 p-0 [&_svg]:h-3 [&_svg]:w-3 md:[&_svg]:h-3.5 md:[&_svg]:w-3.5',

  ICON_MD: 'h-8 w-8 p-0 [&_svg]:h-4 [&_svg]:w-4',
} as const;

// Usage:
// import { COLORS, BUTTON_CLASSES } from '@/lib/design-tokens';
// <div className={cn(BUTTON_CLASSES.BASE, BUTTON_CLASSES.HOLLOW)} />
```

---

## 📊 MIGRATION PLAN

### Phase 1: Establish Foundation (1 hour)

1. **Add missing button tokens** to `src/index.css`
2. **Map tokens** in `tailwind.config.ts`
3. **Create utility classes** in `index.css`
4. **Test tokens work** (restart dev server)

### Phase 2: Fix Button Component (30 min)

**Update `src/components/ui/button.tsx` to use ONLY tokens:**

```typescript
// ❌ BEFORE (inline):
'hover:bg-cb-ink'  // BLACK - wrong!
'dark:bg-[#202020]'  // Inline hex

// ✅ AFTER (tokens):
'hover:bg-cb-hover dark:hover:bg-cb-panel-dark'  // Light gray token
'dark:bg-card'  // Token for #202020
```

### Phase 3: Create Find-Replace Script (30 min)

**Create `scripts/migrate-to-tokens.sh`:**

```bash
#!/bin/bash

# Replace common inline colors with tokens

# #111111 → bg-cb-ink or text-cb-ink
find src -name "*.tsx" -type f -exec sed -i '' 's/bg-\[#111111\]/bg-cb-ink/g' {} \;
find src -name "*.tsx" -type f -exec sed -i '' 's/text-\[#111111\]/text-cb-ink/g' {} \;

# #F8F8F8 → bg-cb-hover
find src -name "*.tsx" -type f -exec sed -i '' 's/bg-\[#F8F8F8\]/bg-cb-hover/g' {} \;
find src -name "*.tsx" -type f -exec sed -i '' 's/hover:bg-\[#F8F8F8\]/hover:bg-cb-hover/g' {} \;

# #202020 → dark:bg-card
find src -name "*.tsx" -type f -exec sed -i '' 's/dark:bg-\[#202020\]/dark:bg-card/g' {} \;

# #E5E5E5 → border-cb-border
find src -name "*.tsx" -type f -exec sed -i '' 's/border-\[#E5E5E5\]/border-cb-border/g' {} \;

# hover:bg-cb-ink → hover:bg-cb-hover (BLACK to light gray)
find src -name "*.tsx" -type f -exec sed -i '' 's/hover:bg-cb-ink/hover:bg-cb-hover/g' {} \;

echo "✅ Migration complete! Review changes with git diff"
```

### Phase 4: Enable ESLint Enforcement (15 min)

1. Add ESLint rule
2. Run linter: `npm run lint`
3. Fix any remaining violations
4. Commit

### Phase 5: Documentation (30 min)

1. Update brand guidelines with token system
2. Create "Token Cheat Sheet" for developers
3. Add to CLAUDE.md

---

## 🧪 VALIDATION

After migration, verify:

```bash
# Should return 0 results:
grep -r "#111111" src/
grep -r "#F8F8F8" src/
grep -r "#202020" src/
grep -r "hover:bg-cb-ink" src/
grep -r "bg-\[#" src/

# Should return many results (good!):
grep -r "bg-cb-hover" src/
grep -r "border-cb-border" src/
grep -r "dark:bg-card" src/
```

---

## 📖 DEVELOPER CHEAT SHEET

### Quick Token Reference

| Need | Light Mode | Dark Mode | Token |
|------|------------|-----------|-------|
| **White background** | #FFFFFF | #202020 | `bg-white dark:bg-card` |
| **Hover state** | #F8F8F8 | #2A2A2A | `hover:bg-cb-hover dark:hover:bg-cb-panel-dark` |
| **Border** | #E5E5E5 | #3A3A3A | `border-cb-border dark:border-cb-border-dark` |
| **Primary text** | #111111 | #FFFFFF | `text-cb-ink dark:text-white` |
| **Muted text** | #7A7A7A | #6B6B6B | `text-cb-ink-muted dark:text-cb-text-dark-muted` |
| **Ghost hover** | rgba(0,0,0,0.05) | rgba(255,255,255,0.05) | `hover:bg-muted/50` |

### Button Patterns

```tsx
// Hollow button (with border)
<button className="btn-hollow btn-icon-md">

// Ghost button (transparent)
<button className="btn-ghost btn-icon-sm">

// Or use component:
<Button variant="hollow" size="icon">
```

---

## 🎯 THE FIX

**Current Problem:**
```tsx
// 50 different implementations:
className="hover:bg-cb-ink"           // Component A (BLACK)
className="hover:bg-[#F8F8F8]"        // Component B (inline)
style={{ background: '#F8F8F8' }}     // Component C (inline style)
className="dark:bg-[#202020]"         // Component D (inline)
```

**After Token System:**
```tsx
// ONE token, 50 components:
className="hover:bg-cb-hover dark:hover:bg-cb-panel-dark"

// Change in ONE place (index.css):
--cb-hover: 0 0% 97%;  /* Change this, updates EVERYWHERE */
```

---

## ⏱️ TOTAL TIME

- Phase 1 (tokens): 1 hour
- Phase 2 (button.tsx): 30 min
- Phase 3 (migration script): 30 min
- Phase 4 (ESLint): 15 min
- Phase 5 (docs): 30 min

**Total: ~3 hours to fix permanently**

---

**Summary:** The token system EXISTS, but isn't being used. The fix is to:
1. Complete the token definitions
2. Migrate inline colors to tokens
3. Enforce with ESLint
4. Update once, fix everywhere

**This is the REAL fix** - not patching 50 components individually.
