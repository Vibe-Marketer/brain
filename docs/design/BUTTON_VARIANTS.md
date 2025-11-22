# BUTTON VARIANTS - Implementation Reference

**Quick reference for all button implementations in Conversion Brain**

Copy-paste these exact implementations. Always reference this file when creating buttons.

---

## 1. PRIMARY BUTTON (Main Actions)

**When:** Primary call-to-action, form submissions, critical operations

```tsx
<Button variant="default">Save Changes</Button>
<Button variant="default" size="sm">Submit</Button>
<Button variant="default" size="lg">Get Started</Button>
```

**Properties:**
- Variant: `default`
- Sizes: `sm` | `default` | `lg`
- Border: Yes (slate)
- Background: Slate gradient
- Hover: Subtle shadow enhancement
- Active: Vibe green outline + press down
- Auto-includes: `type="button"`

---

## 2. SECONDARY BUTTON (With Border)

**When:** Cancel, Close, Back, secondary actions that need visual weight

```tsx
<Button variant="hollow">Cancel</Button>
<Button variant="hollow" size="sm">Back</Button>
```

**Properties:**
- Variant: `hollow`
- Sizes: `sm` | `default` | `lg`
- Border: Yes (cb-border)
- Background: White (light) / #202020 (dark)
- Hover: Light gray (cb-hover)
- Auto-includes: `type="button"`

---

## 3. DESTRUCTIVE BUTTON (Dangerous Actions)

**When:** Delete, Remove, permanent destructive operations

```tsx
<Button variant="destructive">Delete Account</Button>
<Button variant="destructive" size="sm">Remove</Button>
```

**Properties:**
- Variant: `destructive`
- Sizes: `sm` | `default` | `lg`
- Border: Yes (red)
- Background: Red gradient
- Hover: Subtle shadow enhancement
- Active: Vibe green outline + press down
- Auto-includes: `type="button"`

---

## 4. LINK BUTTON (Text-Only)

**When:** "Learn more", "View details", tertiary text-only actions

```tsx
<Button variant="link">Learn more</Button>
<Button variant="link">View details</Button>
```

**Properties:**
- Variant: `link`
- No border
- Background: Transparent
- Hover: Underline (vibe green)
- Auto-includes: `type="button"`

---

## 5. ICON-ONLY BUTTON (Transparent, No Border)

**When:** Table row actions (view/edit/download), close X, toolbar icons

```tsx
{/* Table Row Actions */}
<Button variant="ghost" size="icon-sm" title="View details">
  <Eye className="h-3 w-3 md:h-3.5 md:w-3.5" />
</Button>

<Button variant="ghost" size="icon-sm" title="Edit">
  <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5" />
</Button>

<Button variant="ghost" size="icon-sm" title="Download">
  <Download className="h-3 w-3 md:h-3.5 md:w-3.5" />
</Button>

{/* Close Dialog X */}
<Button variant="ghost" size="icon" title="Close">
  <X className="h-4 w-4" />
</Button>
```

**Properties:**
- Variant: `ghost`
- Sizes: `icon-sm` (20-24px responsive) | `icon` (32px)
- No border
- Background: Transparent
- Hover: Light gray (bg-muted/50)
- Icon sizing:
  - `icon-sm`: h-3 w-3 on mobile, h-3.5 w-3.5 on desktop
  - `icon`: h-4 w-4 always
- Auto-includes: `type="button"`

---

## 6. TABLE BADGE BUTTON (With Border + Content)

**When:** Participant count, tag count, clickable metrics in tables

```tsx
<Button
  variant="hollow"
  size="sm"
  className="h-auto py-1 px-2 gap-1.5 text-xs w-full justify-center"
>
  <Users className="h-3.5 w-3.5 flex-shrink-0" />
  <span className="text-xs font-medium min-w-[20px] text-center tabular-nums">
    16
  </span>
</Button>
```

**Properties:**
- Variant: `hollow` (gets border automatically)
- Size: `sm` (as base)
- Override with className: `h-auto py-1 px-2 gap-1.5 text-xs`
- Border: Yes (visible)
- Hover: Light gray
- Icon: h-3.5 w-3.5
- Text: text-xs with tabular-nums for numbers
- Auto-includes: `type="button"`

---

## 7. PAGINATION/NAVIGATION BUTTON (With Border)

**When:** < > arrows, page navigation, search icon buttons

```tsx
{/* Arrow Navigation */}
<Button variant="hollow" size="icon">
  <ChevronLeft className="h-4 w-4" />
</Button>

<Button variant="hollow" size="icon">
  <ChevronRight className="h-4 w-4" />
</Button>

{/* Search Button */}
<Button variant="hollow" size="icon">
  <Search className="h-4 w-4" />
</Button>
```

**Properties:**
- Variant: `hollow` (gets border automatically)
- Size: `icon` (32x32px)
- Border: Yes (visible)
- Background: White (light) / #202020 (dark)
- Hover: Light gray (NOT black)
- Icon sizing: h-4 w-4
- Auto-includes: `type="button"`

---

## DECISION TREE

```
START: What kind of button do I need?

Is this the MAIN action on the screen? (Save, Submit, Create)
├─ YES → <Button variant="default">

Is this a DANGEROUS action? (Delete, Remove, Destroy)
├─ YES → <Button variant="destructive">

Is this ICON-ONLY with NO border?
├─ In table row? (View/Edit/Download)
│  └─ YES → <Button variant="ghost" size="icon-sm">
├─ Close X in dialog?
│  └─ YES → <Button variant="ghost" size="icon">
└─ NO ↓

Is this ICON-ONLY with BORDER?
├─ Pagination arrows? (< >)
│  └─ YES → <Button variant="hollow" size="icon">
├─ Search button?
│  └─ YES → <Button variant="hollow" size="icon">
└─ NO ↓

Is this a TABLE BADGE? (Count/metric with icon)
├─ YES → <Button variant="hollow" size="sm" className="h-auto py-1 px-2">

Is this TEXT-ONLY? (Learn more, View details)
├─ YES → <Button variant="link">

Is this a SECONDARY action? (Cancel, Close, Back)
└─ YES → <Button variant="hollow">
```

---

## COMMON MISTAKES TO AVOID

### ❌ DON'T:
```tsx
// DON'T use custom button with inline classes
<button className="h-5 w-5 p-0 inline-flex...">

// DON'T omit type attribute (now automatic)
<Button onClick={...}>

// DON'T use variant="outline" or variant="secondary" (not in guidelines)
<Button variant="outline">

// DON'T use wrong hover state
className="hover:bg-cb-ink" // ← Turns BLACK (wrong)
```

### ✅ DO:
```tsx
// DO use Button component with variant
<Button variant="ghost" size="icon-sm">

// DO use automatic type="button"
<Button variant="default">

// DO use hollow for bordered secondary buttons
<Button variant="hollow">

// DO use light hover
className="hover:bg-cb-hover" // ← Light gray (correct)
```

---

## IMPORT STATEMENT

```tsx
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Download, X, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
```

---

## TROUBLESHOOTING

**Button turns black on hover?**
- You're using `size="icon"` with old hover state
- Fix: Use `variant="ghost"` for transparent OR `variant="hollow"` for bordered

**Button submitting form unexpectedly?**
- Button component now defaults `type="button"`
- If you WANT to submit, explicitly use `type="submit"`

**Icon too big/small?**
- `icon-sm`: Use h-3 w-3 (mobile) md:h-3.5 md:w-3.5 (desktop)
- `icon`: Use h-4 w-4

**Border not showing on pagination buttons?**
- Use `variant="hollow" size="icon"` NOT `variant="ghost"`

**Table badge looks wrong?**
- Must use `variant="hollow" size="sm" className="h-auto py-1 px-2 gap-1.5 text-xs"`
- Don't forget `tabular-nums` on count span

---

## VALIDATION CHECKLIST

Before committing button code:

- [ ] Used Button component (not custom `<button>`)
- [ ] Variant matches use case (see decision tree)
- [ ] Size appropriate for context
- [ ] Icon sizing correct (h-3 w-3 for icon-sm, h-4 w-4 for icon)
- [ ] No `hover:bg-cb-ink` (turns black - wrong)
- [ ] Uses `hover:bg-cb-hover` or `hover:bg-muted/50` (light gray - correct)
- [ ] Includes `title` attribute for icon-only buttons
- [ ] `tabular-nums` on numeric spans
- [ ] Responsive icon sizing where needed (md:h-3.5 md:w-3.5)

---

**Last Updated:** 2025-11-20
**Maintained By:** Brand Guidelines Team
**Reference:** brand-guidelines-v3.3.md (to be updated)
