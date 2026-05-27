---
id: "01-C"
phase: 1
title: "Friendly Paste Error UX (MAN-05)"
type: implementation
status: pending
files_modified:
  - src/components/import/PasteTranscriptModal.tsx
---

# Plan 01-C: Friendly Paste Error UX (MAN-05)

## Goal

When a paste fails (bad format, dedup hit, parse error, workspace permission denied), the user sees a clear inline error with a next step — never a stack trace, never silence. Error states are shown as inline banners inside the modal, not just toasts.

## Current State

The modal currently uses `toast.error()` for all errors. The error messages are generic (e.g., "Failed to save transcript"). Users have no way to understand what went wrong or what to do next.

## Design

Inline error banner appears above the Save button, inside the modal (user can still read the transcript and correct it). Specific error conditions produce distinct messages:

| HTTP Status / Signal | User Message | Next Step |
|---------------------|-------------|-----------|
| 409 Conflict (dedup) | "This transcript was already imported. It's in your vault." | "View it →" link to existing recording |
| 400 Bad format | "We couldn't parse this format. Your transcript was saved as plain text — you can edit the title and date." | Save continues (soft warning) |
| 403 Workspace denied | "You don't have access to this workspace. Make sure you're in the right org." | Link to /settings |
| 401 Auth | "Session expired. Please refresh the page and try again." | None |
| 400 Too short | "Transcript is too short (need at least 20 characters)." | None |
| 500 / network | "Failed to save transcript. Please try again or contact support." | Collapsed "Details" toggle |

## Tasks

### Task 1: Add error state to `PasteTranscriptModal.tsx`

Add state:
```typescript
const [inlineError, setInlineError] = useState<{
  type: 'dedup' | 'format' | 'auth' | 'permission' | 'server' | 'unknown';
  message: string;
  detail?: string;
  recordingId?: string; // For dedup "View it" link
} | null>(null);
```

Reset on modal open:
```typescript
useEffect(() => {
  if (open) {
    // ... existing resets
    setInlineError(null);
  }
}, [open]);
```

### Task 2: Error mapping function

```typescript
function mapApiError(status: number, errorBody: { error?: string; data?: { recording_id?: string } }): typeof inlineError {
  const msg = errorBody.error ?? '';

  if (status === 409 || msg.toLowerCase().includes('already imported')) {
    return {
      type: 'dedup',
      message: "This transcript was already imported. It's in your vault — no action needed.",
      recordingId: (errorBody as { data?: { recording_id?: string } })?.data?.recording_id,
    };
  }
  if (status === 403) {
    return {
      type: 'permission',
      message: "You don't have access to this workspace. Make sure you're in the right org.",
    };
  }
  if (status === 401) {
    return {
      type: 'auth',
      message: 'Session expired. Please refresh the page and try again.',
    };
  }
  if (status === 400) {
    return {
      type: 'format',
      message: msg || 'Invalid input. Check the transcript and try again.',
    };
  }
  return {
    type: 'server',
    message: 'Failed to save transcript. Please try again or contact support.',
    detail: msg || undefined,
  };
}
```

### Task 3: Update `handleSave()` to populate inline error

Replace the current `toast.error()` call with:
```typescript
const { data, error } = await supabase.functions.invoke('save-pasted-transcript', { body });

if (error) {
  // Parse the error response — supabase.functions.invoke wraps HTTP errors
  const status = (error as { status?: number })?.status ?? 500;
  const parsed = { error: error.message };
  setInlineError(mapApiError(status, parsed));
  setSubmitting(false);
  return;
}

// Also check for API-level error in the response body
const responseData = data as { error?: string; data?: { recording_id?: string; action?: string } } | null;
if (responseData?.error) {
  setInlineError(mapApiError(200, responseData)); // 200 with error body
  setSubmitting(false);
  return;
}
```

### Task 4: Render inline error banner in JSX

Add above `<DialogFooter>`:

```tsx
{inlineError && (
  <div
    role="alert"
    className={cn(
      "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
      inlineError.type === 'dedup'
        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
        : inlineError.type === 'format'
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
          : "bg-destructive/10 border-destructive/30 text-destructive"
    )}
  >
    <RiAlertLine className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
    <div className="flex-1 min-w-0">
      <p className="font-medium">{inlineError.message}</p>
      {inlineError.type === 'dedup' && inlineError.recordingId && (
        <button
          type="button"
          onClick={() => {
            navigate(`/?callId=${encodeURIComponent(inlineError.recordingId!)}`);
            onOpenChange(false);
          }}
          className="mt-1 text-xs underline underline-offset-2 hover:no-underline"
        >
          View it →
        </button>
      )}
      {inlineError.detail && (
        <details className="mt-1">
          <summary className="text-xs cursor-pointer opacity-70">Details</summary>
          <p className="text-xs mt-1 font-mono break-all opacity-80">{inlineError.detail}</p>
        </details>
      )}
    </div>
    <button
      type="button"
      onClick={() => setInlineError(null)}
      className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
      aria-label="Dismiss error"
    >
      <RiCloseLine className="h-4 w-4" />
    </button>
  </div>
)}
```

Add `RiCloseLine` to imports from `@remixicon/react`.

### Task 5: Dismiss error on new transcript input

Add to the `setTranscript` onChange handler:
```typescript
onChange={(e) => {
  setTranscript(e.target.value);
  if (inlineError) setInlineError(null); // Dismiss error when user edits
}}
```

## Verification

- Paste a valid transcript → 200 response, modal closes, navigate to recording
- Paste same Fathom share URL twice → inline dedup banner appears with "View it" link
- Paste to an org you don't belong to → inline permission error
- Paste very short text (<20 chars) and submit → inline 400 error
- Server 500 → inline server error with "Details" toggle
- `npm run build` exits 0
- No TypeScript errors (`npm run type-check`)

## Threat Model

- Error messages never expose JWT tokens, service keys, or raw DB errors — server returns sanitized messages per existing T-24-04 mitigation
- `recordingId` in the "View it" link comes from the server response (not user input) so no open-redirect risk
