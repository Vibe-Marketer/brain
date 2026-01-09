# Design System Documentation

This directory contains the complete design system documentation for CallVault.

## Core Documents

### **[brand-guidelines-v4.1.md](brand-guidelines-v4.1.md)** ⭐ PRIMARY REFERENCE

The authoritative design system documentation. **Read this first** before making any UI changes.

- Color system and usage rules
- Typography standards (Montserrat + Inter)
- Button variants and specifications
- Table design patterns
- Layout rules (90% no-card rule)
- Spacing and grid system
- Dark mode implementation

### **[DESIGN-TOKEN-SYSTEM.md](DESIGN-TOKEN-SYSTEM.md)**

Architecture guide for the design token system.

- Why we use tokens instead of inline colors
- Complete token reference
- Migration guide
- Developer cheat sheet

### **[BUTTON_VARIANTS.md](BUTTON_VARIANTS.md)**

Quick reference for button implementation.

- When to use each variant (PRIMARY, hollow, ghost, link)
- Copy-paste examples
- Decision tree
- Common mistakes to avoid

## Brand Guidelines Changelog

See [brand-guidelines-changelog.md](brand-guidelines-changelog.md) for version history.

## Enforcement

The design system is enforced via:

1. **ESLint** - Custom rule blocks inline colors (`eslint-plugin-design-tokens.js`)
2. **Code review** - Use `/design-review` command
3. **Documentation** - All patterns documented here

## When to Use What

| Task | Document to Check |
|------|-------------------|
| Adding a button | [BUTTON_VARIANTS.md](BUTTON_VARIANTS.md) |
| Choosing colors | [brand-guidelines-v4.1.md](brand-guidelines-v4.1.md) → Color System |
| Typography decisions | [brand-guidelines-v4.1.md](brand-guidelines-v4.1.md) → Typography |
| Table design | [brand-guidelines-v4.1.md](brand-guidelines-v4.1.md) → Table Specifications |
| Understanding tokens | [DESIGN-TOKEN-SYSTEM.md](DESIGN-TOKEN-SYSTEM.md) |
| Dark mode | [brand-guidelines-v4.1.md](brand-guidelines-v4.1.md) → Dark Mode |

## Quick Rules

❌ **NEVER**

- Use inline hex colors (`bg-[#111111]`)
- Use `hover:bg-cb-ink` (creates BLACK hover, use `hover:bg-cb-hover`)
- Mix Montserrat and Inter in same element
- Use vibe green for backgrounds or large areas
- Create card containers for main content (90% rule)

✅ **ALWAYS**

- Use design tokens from `src/index.css`
- Check brand guidelines before UI changes
- Use proper button variants
- Follow typography hierarchy
- Test in both light and dark mode
