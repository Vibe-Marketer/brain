# Accessibility Patterns - Radix UI Dialog Components

## Dialog Description Requirement

Both `Dialog` and `AlertDialog` from Radix UI require a description for screen reader accessibility.

### Pattern: Visually Hidden Description

```tsx
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription className="sr-only">
        Descriptive text for screen readers explaining the dialog purpose.
      </DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

### Pattern: Custom aria-describedby

When using custom `aria-describedby`, ensure the referenced element exists:

```tsx
<DialogContent aria-describedby="custom-description">
  <DialogDescription id="custom-description" className="sr-only">
    Description text here
  </DialogDescription>
  {/* Content */}
</DialogContent>
```

### Suppressing Warning (Not Recommended)

If a description truly isn't needed, pass `aria-describedby={undefined}`:

```tsx
<DialogContent aria-describedby={undefined}>
  {/* Only use when description genuinely not applicable */}
</DialogContent>
```

## Files With Dialog Components

### AlertDialog (all have proper descriptions):
- `DeleteConfirmDialog.tsx`
- `ChatSidebar.tsx` 
- `ConfirmWebhookDialog.tsx`
- `FathomSetupWizard.tsx`
- `FoldersTab.tsx`
- `FolderManagementDialog.tsx`
- `ResyncConfirmDialog.tsx`
- `TrimConfirmDialog.tsx`

### Dialog Components:
- `EditFolderDialog.tsx` ✓ Fixed
- `QuickCreateFolderDialog.tsx` ✓ Fixed
- `CallDetailDialog.tsx` ✓ Fixed
- `ChangeSpeakerDialog.tsx` ✓ Fixed
- `AssignFolderDialog.tsx` - Has description
- `QuickCreateTagDialog.tsx` - Has description
- `ManualTagDialog.tsx` - Has description

## Checking for Missing Descriptions

Command to find Dialog files missing descriptions:
```bash
grep -rl "DialogContent" src/components --include="*.tsx" | xargs -I{} sh -c 'grep -q "DialogDescription\|AlertDialogDescription" "$1" || echo "MISSING: $1"' _ {}
```

## WCAG Compliance
- Dialog descriptions provide context for screen reader users
- `sr-only` class hides text visually but keeps it accessible
- Essential for WCAG 2.1 Level A compliance (4.1.2 Name, Role, Value)
