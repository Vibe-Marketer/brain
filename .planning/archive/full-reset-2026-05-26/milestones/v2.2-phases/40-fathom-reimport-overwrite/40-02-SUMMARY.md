---
plan: 40-02
status: complete
completed: 2026-05-12
---

# Plan 40-02 — Summary

Two new files:

**`src/hooks/useFathomRefresh.ts` (124 lines)** — TanStack Query mutation:
- Wraps `supabase.functions.invoke('fathom-refresh')`
- Parses `FunctionsHttpError` body to extract our edge-function error codes
- Maps 6 codes to Sonner toasts (with "Reconnect" action for `FATHOM_AUTH_EXPIRED`)
- Invalidates `queryKeys.calls.detail(uuid)` + `queryKeys.calls.all` + `['raw-call-data', uuid]` on success
- Accepts `onSettled` callback so callers can close their modal

**`src/components/dialogs/RefreshFromFathomDialog.tsx` (87 lines)** — Radix Dialog:
- Locked confirmation copy (verbatim from CONTEXT.md)
- Disables itself + traps closes while `isPending`
- Single confirm button "Refresh" → "Refreshing…" + spinner while pending
- Shows the optional `callTitle` as a soft secondary line

Both files pass `tsc --noEmit`.
