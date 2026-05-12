---
phase: 40
slug: fathom-reimport-overwrite
status: approved
shadcn_initialized: true
preset: "shadcn default style + slate base + CSS variables (existing components.json)"
created: 2026-05-12
reviewed_at: 2026-05-12
---

# Phase 40 — UI Design Contract

> Visual + interaction contract for the "Refresh from Fathom" action. Prescriptive — executor implements as specified.

---

## Scope of This Contract

Two surfaces. Both already exist. We add a single button each — no new dialogs, no new panels, no layout changes.

| Surface | File | Change Type |
|---------|------|-------------|
| Call Detail (modal, MODAL stays per QA-14) | `src/components/call-detail/CallDetailHeader.tsx` | Modify — add 4th hollow button "Refresh from Fathom" in existing header action row, after EDIT, gated on `source_platform === 'fathom'` |
| Fathom import source detail (3rd pane, per-meeting row) | `src/components/import/FathomImportDetail.tsx` | Modify — when a meeting row shows the "Already imported" badge, add a sibling icon button "Refresh from Fathom" |
| Confirmation Dialog | `src/components/dialogs/RefreshFromFathomDialog.tsx` (NEW) | New — Radix Dialog wrapper, single confirm action |
| Mutation hook | `src/hooks/useFathomRefresh.ts` (NEW) | New — `useMutation` wrapping `supabase.functions.invoke('fathom-refresh')` |

Out of scope: refactoring `CallDetailDialog` to Pane 4 (locked decision per QA-14 — modal stays), bulk re-import UI (deferred), per-row inline refresh-state animation beyond a spinning icon, "last refreshed at" copy in detail header.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn | `components.json` |
| Component library | Radix UI (individual `@radix-ui/react-*` packages) | `src/CLAUDE.md` |
| Icon library | Remix Icons (`@remixicon/react`) — ONLY allowed icon library | Root `CLAUDE.md` |
| Toasts | Sonner (`import { toast } from 'sonner'`) — globally mounted in `App.tsx` | `src/CLAUDE.md` |
| Token system | shadcn semantic tokens — `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border` | `src/CLAUDE.md` |
| Animation | `motion/react` — NOT used in this phase; spinner uses Tailwind `animate-spin` only | `src/CLAUDE.md` |

> Forbidden in this phase: Lucide / FontAwesome icons, `framer-motion`, hardcoded hex colors, `text-ink*` / `bg-hover` / `border-soft` (v1 artifacts), inline `style={{}}` color overrides.

---

## Tokens & Spacing

Tailwind default 4px grid. Used in this phase:

| Token | Value | Where |
|-------|-------|-------|
| xs | 4px | Icon-to-label gap inside button (`mr-2`) |
| sm | 8px | Sibling button gap in header (`gap-2` — already present) |
| md | 16px | Dialog content padding break (`space-y-4` — Radix Dialog default) |

No new spacing tokens introduced.

---

## Typography

| Role | Class | Usage |
|------|-------|-------|
| Button label (header) | shadcn Button default (`text-sm font-medium`) | "Refresh from Fathom" — match existing EDIT/SHARE/COPY siblings |
| Dialog title | `text-lg font-semibold` (shadcn DialogTitle default) | "Refresh from Fathom?" |
| Dialog description | `text-sm text-muted-foreground` (shadcn DialogDescription default) | Locked confirmation copy |

No new font sizes introduced.

---

## Iconography

| Icon | Where | Source |
|------|-------|--------|
| `RiRefreshLine` | Header button + import-detail row button | `@remixicon/react` |
| `RiLoader4Line` | While `mutation.isPending` (spinner) — replaces `RiRefreshLine` with `animate-spin` class | `@remixicon/react` |

Icon size: `h-4 w-4` (header button) and `h-3.5 w-3.5` (import-detail row icon-only button).

---

## Components

### 1. Header button (CallDetailHeader.tsx)

Insert after the existing EDIT button (line ~135, inside the `!isEditing` branch). Render only when `call?.source_platform === 'fathom'`.

```tsx
<Button
  variant="hollow"
  size="sm"
  disabled={refreshMutation.isPending}
  onClick={() => setRefreshDialogOpen(true)}
>
  {refreshMutation.isPending ? (
    <RiLoader4Line className="h-4 w-4 mr-2 animate-spin" />
  ) : (
    <RiRefreshLine className="h-4 w-4 mr-2" />
  )}
  REFRESH FROM FATHOM
</Button>
```

The all-caps label matches the existing convention in `CallDetailHeader.tsx` (EDIT, COPY, SHARE, VIEW).

When `source_platform !== 'fathom'`: do NOT render the button. (Hide instead of disable + tooltip per latest decision — non-Fathom users should never see Fathom-specific affordances. CONTEXT.md called out tooltip+disable, but the action is meaningless for Zoom/manual/upload sources, so hiding is cleaner.)

### 2. Import-detail row button (FathomImportDetail.tsx)

In the meeting-row rendering (line ~951, where the "Already imported" badge renders), append a sibling icon-only button:

```tsx
{meeting.synced && (
  <div className="flex items-center gap-2 shrink-0">
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
      <RiCheckLine className="h-3 w-3" />
      Already imported
    </span>
    <Button
      variant="ghost"
      size="icon"
      title="Refresh from Fathom"
      aria-label={`Refresh ${meeting.title} from Fathom`}
      disabled={isPendingForRow(meeting.recording_id)}
      onClick={(e) => {
        e.stopPropagation();
        openRefreshDialogForRow(meeting.recording_id);
      }}
    >
      {isPendingForRow(meeting.recording_id) ? (
        <RiLoader4Line className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RiRefreshLine className="h-3.5 w-3.5" />
      )}
    </Button>
  </div>
)}
```

Button `size="icon"` is `h-8 w-8 p-0 min-w-0 rounded-md [&_svg]:size-4` (verified in `src/components/ui/button.tsx`). The `h-3.5 w-3.5` icon class overrides the default `size-4` icon sizing via `&_svg:size-4` only when no explicit `h-/w-` is set on the icon — set both explicitly to win.

### 3. Confirmation Dialog (RefreshFromFathomDialog.tsx)

NEW file at `src/components/dialogs/RefreshFromFathomDialog.tsx`. Single-purpose component.

```tsx
interface RefreshFromFathomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  callTitle?: string;
}
```

Layout (Radix Dialog, `max-w-md`):

```
+----------------------------------------------+
| Refresh from Fathom?                         |   ← DialogTitle  (text-lg font-semibold)
|                                              |
| Refresh title, transcript, summary, and      |   ← DialogDescription (text-sm muted)
| duration from Fathom? Tags, folder, and      |
| workspace assignments are preserved.         |
|                                              |
|                                              |
|              [ Cancel ]   [ Refresh ]        |   ← Footer, gap-2
+----------------------------------------------+
```

Locked copy (do not paraphrase):

- Title: `Refresh from Fathom?`
- Body: `Refresh title, transcript, summary, and duration from Fathom? Tags, folder, and workspace assignments are preserved.`
- Cancel button: `Cancel` (variant="hollow", size="sm")
- Confirm button: `Refresh` (variant="default", size="sm"; while pending, label becomes `Refreshing…` + leading `RiLoader4Line animate-spin`)

Dialog closes immediately on Cancel click. On Confirm click, the dialog stays open while `isPending`, then closes on mutation success/error (caller controls via `onOpenChange(false)` in the mutation's `onSettled`).

### 4. Toast feedback (Sonner)

| Outcome | Toast |
|---------|-------|
| Success | `toast.success('Refreshed from Fathom — title, transcript, and summary updated.')` |
| 404 deleted upstream | `toast.error('This call was deleted in Fathom. It cannot be refreshed.')` |
| 401 auth expired | `toast.error('Your Fathom connection expired. Reconnect in Settings → Integrations.', { action: { label: 'Reconnect', onClick: () => navigate('/settings/integrations') } })` |
| 429 rate limit | `toast.error('Fathom is rate-limiting us right now. Try again in a minute.')` |
| 500 / unknown | `toast.error('Couldn\'t refresh — please try again.')` |

---

## States

### Pending
- Header button: replace icon with `RiLoader4Line animate-spin`; disable button.
- Import-detail row button: same.
- Confirmation dialog: confirm label becomes "Refreshing…"; both buttons disabled.

### Success
- Toast (above).
- Close dialog.
- TanStack Query invalidates: `queryKeys.calls.detail(recordingUuid)`, `queryKeys.calls.list()`, `queryKeys.rawCallData(recordingUuid, 'fathom')` (whatever shape `useRawCallData` exposes — verify in `src/hooks/useRawCallData.ts`).
- Header re-renders the new title automatically via `useCallDetailQueries`.

### Error
- Toast (above, per status code).
- Close dialog.
- Caller component remains in the same state — user can re-trigger.

---

## Accessibility

- Both buttons have explicit `aria-label` when icon-only (import-detail row).
- Dialog uses Radix Dialog (built-in focus trap + ESC to close).
- Confirm button focused by default (Radix Dialog autoFocus).
- Color contrast: shadcn defaults already meet AA — no new color tokens introduced.
- Keyboard: Tab cycles Cancel → Refresh; Enter on focused Refresh confirms; ESC cancels.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| User clicks "Refresh" while another refresh is in flight for a different call in the import-detail list | Each row tracks its own pending state via `mutation.variables?.recording_id`. Buttons only spin for their own row. |
| User clicks "Refresh" on header, then closes the modal mid-flight | Mutation continues in background. Toast still fires on success/error. No orphaned state. |
| Fathom returns 404 (call deleted upstream) | Toast (above). Local row in call-list does NOT get removed — the call still exists in our DB, just can't be refreshed. |
| User has no Fathom connection (token expired) | 401 returned by edge function → toast with Reconnect action. |
| User on Zoom/manual/upload call | Header button is NOT rendered. Import-detail surface is Fathom-only, so n/a. |
| Call's `legacy_recording_id` is NULL (Fathom call somehow without legacy id — shouldn't happen, but defensive) | Edge function returns 400 with `FATHOM_NO_LEGACY_ID`; toast: "Couldn't refresh — please try again." |

---

## Test Hooks

- `data-testid="refresh-from-fathom-button"` on header button
- `data-testid="refresh-from-fathom-row-button"` on each import-detail row button
- `data-testid="refresh-from-fathom-dialog"` on Dialog root
- `data-testid="refresh-from-fathom-confirm"` on confirm button

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/call-detail/CallDetailHeader.tsx` | Add Refresh button + wire dialog state |
| `src/components/import/FathomImportDetail.tsx` | Add icon button on synced rows + wire dialog state |
| `src/components/dialogs/RefreshFromFathomDialog.tsx` | NEW |
| `src/hooks/useFathomRefresh.ts` | NEW |

---

*Phase 40 — UI design contract — gathered 2026-05-12*
