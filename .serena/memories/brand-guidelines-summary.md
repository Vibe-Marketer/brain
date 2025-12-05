# Brand Guidelines Quick Reference

**Full document**: `docs/design/brand-guidelines-v3.4.md` (MUST READ for UI work)

## Critical Rules

### Vibe Orange (#FF8800) - ONLY 9 Uses
1. Active tab underlines (6px angular)
2. Left-edge indicators on metric cards (6px × 56px)
3. Sortable column header underlines (3px)
4. Focus states (3px left border inputs, 2px outline buttons)
5. Circular progress indicators (filled portion)
6. Progress trackers (onboarding)
7. Wayfinding step indicators
8. Section dividers (onboarding only)
9. Contextual info banners (subtle accent)

**NEVER use vibe orange for**: Text, button backgrounds, card backgrounds, icons, large areas

### Background Hierarchy
- `bg-viewport`: Body background (#FCFCFC light / #161616 dark)
- `bg-card`: Content cards (#FFFFFF light / #202020 dark)

### Typography
- **Headings**: Montserrat Extra Bold, ALL CAPS
- **Body**: Inter Light (300) or Regular (400)
- **Interactive**: Inter Medium (500)
- **Table headers**: 12px uppercase, Inter Medium
- **Numbers**: Always `tabular-nums`

### Button Variants (4 only)
1. `variant="default"` - Slate gradient (primary)
2. `variant="hollow"` - White/bordered (secondary)
3. `variant="destructive"` - Red gradient (danger)
4. `variant="link"` - Text only (tertiary)

### Icons
- Library: Remix Icon (`@remixicon/react`)
- Style: `-line` (outlined) variants
- Color: `text-cb-ink-muted`
- Size: 16px (`h-4 w-4`) for inline/buttons
- **DO NOT mix icon libraries**

### Layout
- 90% rule: NO card containers (use white background + thin borders)
- 10% exception: Modals, dropdowns, search bars, metric cards only
- Gutters: 8px right/bottom/left, top at 52px
- Spacing: 4px grid (Tailwind defaults)

### Tabs
- Active underline: 6px height, vibe orange, angular/parallelogram shape
- Full-width black underline on TabsList
- Left-justified, 24px gap (enforced)

## Deviation Protocol
**NEVER implement deviating UI without asking first**
1. Check brand-guidelines-v3.4.md
2. If deviation needed, ASK USER first
3. Suggest guideline-compliant alternative
