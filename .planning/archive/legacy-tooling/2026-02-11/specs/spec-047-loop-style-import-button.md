# SPEC-047: Loop-Style Import Button

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sidebar/Navigation
**Priority:** UI Enhancement

---

## Summary

Redesign the Import/Sync button to match Microsoft Loop's "Create new" button style: transparent fill with a glowing vibe orange gradient border and outer glow shadow. The button should be pill-shaped when expanded and circular when collapsed.

## Reference Images

- Expanded: `docs/planning/create-button-expanded.png`
- Collapsed: `docs/planning/create-button-collapsed.png`

## What

Replace the current solid gradient fill button with a Loop-inspired design featuring:

1. **Transparent fill** - Works with both light and dark mode backgrounds
2. **Gradient border** - Vibe orange gradient (#FFEB00 → #FF8800 → #FF3D00) as a 2-3px border
3. **Outer glow** - Orange box-shadow for neon glow effect
4. **Pill shape (expanded)** - Rounded rectangle with full-radius corners
5. **Circular (collapsed)** - Perfect circle with same glowing border

**File to modify:**
- `src/components/ui/sidebar-nav.tsx` (lines 388-427)

**Current implementation:**
```tsx
// Solid gradient fill (current)
style={{
  background: 'linear-gradient(135deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%)',
}}
```

**New implementation:**
```tsx
// Transparent fill with gradient border and glow
style={{
  background: 'transparent',
  border: '2px solid transparent',
  backgroundImage: 'linear-gradient(var(--cb-card), var(--cb-card)), linear-gradient(135deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%)',
  backgroundOrigin: 'border-box',
  backgroundClip: 'padding-box, border-box',
  boxShadow: '0 0 20px rgba(255, 136, 0, 0.4), 0 0 40px rgba(255, 136, 0, 0.2)',
}}
```

## Why

- Match the polished, modern look of Microsoft Loop
- Transparent fill works better with both light/dark modes
- Glowing border creates visual hierarchy without being heavy
- The "neon" effect draws attention to the primary CTA
- Current solid gradient can feel heavy/dated

## User Experience

**Expanded state:**
- User sees pill-shaped button with glowing orange border
- "+ Import" text with white icon inside
- Subtle orange glow emanates from button edges
- Hover: Glow intensifies slightly

**Collapsed state:**
- User sees circular button with glowing orange ring
- Just "+" icon centered
- Same glow effect as expanded
- Hover: Glow intensifies

**Both modes:**
- Transparent fill shows underlying sidebar background
- Works seamlessly in light and dark mode
- 500ms transitions per brand guidelines

## Scope

**Includes:**
- Redesigning button in `sidebar-nav.tsx`
- Both collapsed and expanded states
- Hover/focus states with enhanced glow
- Light and dark mode support

**Excludes:**
- Moving button position (handled by PRD-001)
- Changing button functionality
- Other sidebar buttons

## Technical Details

### Gradient Border Technique

Use CSS background-clip trick for gradient borders:

```css
.loop-button {
  background: transparent;
  border: 2px solid transparent;
  background-image:
    linear-gradient(var(--background), var(--background)),
    linear-gradient(135deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%);
  background-origin: border-box;
  background-clip: padding-box, border-box;
}
```

### Glow Effect

```css
.loop-button {
  box-shadow:
    0 0 15px rgba(255, 136, 0, 0.3),
    0 0 30px rgba(255, 136, 0, 0.15);
}

.loop-button:hover {
  box-shadow:
    0 0 20px rgba(255, 136, 0, 0.5),
    0 0 40px rgba(255, 136, 0, 0.25);
}
```

### Shape Specifications

| State | Shape | Size | Border Radius |
|-------|-------|------|---------------|
| Collapsed | Circle | 44x44px | `rounded-full` |
| Expanded | Pill | auto x 40px | `rounded-full` |

### Color Specifications

| Element | Value |
|---------|-------|
| Border gradient start | #FFEB00 (vibe-orange-light) |
| Border gradient mid | #FF8800 (vibe-orange) |
| Border gradient end | #FF3D00 (vibe-orange-dark) |
| Glow color | rgba(255, 136, 0, 0.3) |
| Fill | transparent |
| Icon/text | white (#FFFFFF) |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Light mode | Transparent fill shows light background |
| Dark mode | Transparent fill shows dark background |
| Focus state | Add focus ring outside glow |
| Disabled state | Reduce glow opacity to 0.1 |

## Acceptance Criteria

- [ ] Button has transparent fill (not solid gradient)
- [ ] Vibe orange gradient border visible
- [ ] Outer glow shadow present
- [ ] Collapsed: circular shape
- [ ] Expanded: pill shape
- [ ] Works in light mode
- [ ] Works in dark mode
- [ ] Hover increases glow intensity
- [ ] 500ms transitions
- [ ] Icon and text remain white

## User Story

**As a** CallVault user
**I want** a modern, glowing Import button like Microsoft Loop
**So that** the primary CTA stands out elegantly without being visually heavy

---

## Visual Comparison

**Loop (purple/cyan):**
- Collapsed: Circular with glowing purple-cyan gradient ring
- Expanded: Pill with "+ Create new" and same glowing border

**CallVault (vibe orange):**
- Collapsed: Circular with glowing orange gradient ring
- Expanded: Pill with "+ Import" and same glowing border

---

*Spec ready for PRD generation.*
