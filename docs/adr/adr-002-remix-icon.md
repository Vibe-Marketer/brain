# ADR-002: Use Remix Icon as Standard Icon Library

**Status**: Accepted

**Date**: 2025-11-19

**Author**: AI-assisted with Claude

## Context

The codebase currently uses a mix of icon libraries:

- Lucide React (partial usage)
- React Icons (Bootstrap, Tabler, Font Awesome subsets)

This creates visual inconsistency - different stroke weights, corner radii, and design philosophies across icons. We need a single, comprehensive icon library that:

- Has consistent design language (stroke weight, grid, corners)
- Covers all common UI needs (3000+ icons)
- Works well with React and supports tree-shaking
- Is open source and actively maintained
- Matches our minimal, professional brand aesthetic

Options considered:

1. **Lucide** - Good but smaller set (~1000 icons), already partially used
2. **Heroicons** - Limited set (~300), Tailwind-focused
3. **Remix Icon** - 3100+ icons, neutral style, Apache 2.0 license, React package

## Decision

We will use **Remix Icon** (`@remixicon/react`) as the exclusive icon library for all components.

Remix Icon provides a neutral, professional aesthetic with consistent 24x24 grid and stroke weights. The library is comprehensive enough to avoid needing multiple sources, and the React package supports tree-shaking for bundle size optimization.

## Consequences

### Positive

- Visual consistency across all icons (same stroke, corners, proportions)
- 3100+ icons covers virtually all UI needs
- Apache 2.0 license allows free commercial use
- Tree-shaking keeps bundle size minimal
- Both outlined (`-line`) and filled (`-fill`) variants available
- Active maintenance with regular updates

### Negative

- Migration effort to replace existing Lucide/React Icons usage
- Team needs to learn Remix Icon naming conventions
- Some specific icons may not have exact equivalents (need mapping)

### Neutral

- Added to brand guidelines as required standard (section 5)
- Migration guide included in brand guidelines for Lucide → Remix mapping
- All new components must use Remix Icon exclusively

**Related**: Documented in brand-guidelines-v3.3.md Icon System section
