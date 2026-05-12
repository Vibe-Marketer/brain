# BRAND-07 Audit — Doubled X Close Button

**Date:** 2026-05-12
**Status:** NO-REPRO

## What was checked

Phase 29 sweep flagged "doubled X close button" (Image #7) somewhere in the app shell.
This audit traced every `RiCloseLine` / `<X` usage in dialogs and panels.

### Code scan

```
grep -ln "DialogContent" src/components/dialogs/*.tsx | \
  xargs grep -l "<RiCloseLine\|<X " 2>/dev/null
```

Plus:
```
for f in $(grep -ln "DialogContent" src/components/dialogs/*.tsx); do
  if grep -q "from '@/components/ui/dialog'" "$f"; then
    if grep -q "<RiCloseLine\|<X " "$f"; then echo "$f"; fi
  fi
done
```

Result: NO file imports from `@/components/ui/dialog` AND has a custom
close X inside `DialogContent`.

### Findings

1. `src/components/ui/dialog.tsx` (shadcn primitive) auto-renders a top-right
   close X via `<DialogPrimitive.Close>` containing `<RiCloseLine>`.
2. `TeamInviteDialog.tsx`, `ShareCallDialog.tsx` render a footer
   `<Button><RiCloseLine />CLOSE</Button>` — that's a labeled footer button,
   not a duplicate X icon in the top-right.
3. `ContactCard.tsx`, `WorkspaceDetailPanel.tsx`, `FolderDetailPanel.tsx`,
   `TagDetailPanel.tsx`, `WorkspaceMemberPanel.tsx`, `RoutingRulePanel.tsx`
   all render their own close X in their header — but they are rendered in
   Pane 4 (via `DetailPaneOutlet`), NOT inside a Dialog. Pane 4 has no
   built-in close X, so this is the ONLY close.
4. The `AlertDialog` instances inside those panels do not include an
   auto-close X (AlertDialog requires explicit Cancel/Action buttons).

## Conclusion

No doubled X close button exists in the current codebase. The Phase 29 Image
#7 finding may have been resolved by a prior phase (e.g. Phase 30/31/32/33
which heavily refactored panel/dialog chrome), or refers to a state-dependent
dialog not currently active.

## Action taken

Marking BRAND-07 closed as NO-REPRO. If the issue re-emerges, re-screenshot
and re-open BRAND-07 (or a successor ticket) with the specific surface where
the double X appears.
