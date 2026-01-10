# White Screen Fixes - Quick Reference

**Date:** 2025-12-04
**Commits:** cdf90a8, 9dbb3e1, 31cafce, ad19a27

---

## Quick Component Lookup

Use this guide to quickly understand what was fixed in each component and why.

---

### BulkActionToolbarEnhanced.tsx

**Location:** `src/components/transcript-library/BulkActionToolbarEnhanced.tsx`

**What it does:** Toolbar that appears when user selects transcripts in table

**What was broken:**

- Used `TagManagementDialog` with wrong props (passed `selectedCalls` instead of `tags`)
- When dialog tried to call `tags.map()`, it received `selectedCalls` → crash
- No validation on `recording_id` before API calls

**What was fixed:**

```typescript
// Lines 245-255: Replaced TagManagementDialog with ManualTagDialog
<ManualTagDialog
  open={showManualTagDialog}
  onOpenChange={setShowManualTagDialog}
  recordingIds={selectedCalls
    .filter(c => c?.recording_id != null)
    .map(c => String(c.recording_id))}
  onTagsUpdated={() => {
    setShowManualTagDialog(false);
    onClearSelection();
  }}
/>

// Lines 80-87, 129-136: Added recording_id validation
const recordingIds = selectedCalls
  .filter(c => c?.recording_id != null)
  .map(c => Number(c.recording_id));

if (recordingIds.length === 0) {
  toast.error('Invalid selection: no valid recording IDs');
  return;
}
```

**User impact:** Selecting transcripts from table no longer causes white screen

---

### TranscriptsTab.tsx

**Location:** `src/components/transcripts/TranscriptsTab.tsx`

**What it does:** Main transcripts tab container

**What was broken:**

- `selectedCall` typed as `any` instead of proper type

**What was fixed:**

```typescript
// Line 73: Changed from any to Meeting | null
const [selectedCall, setSelectedCall] = useState<Meeting | null>(null);
```

**User impact:** Type safety improved, prevents passing invalid call objects

---

### CallDetailDialog.tsx

**Location:** `src/components/CallDetailDialog.tsx`

**What it does:** Dialog showing full call details when user selects a transcript

**What was broken:**

- State initialization timing bug
- When dialog opened with new call, title/summary didn't update
- Editing state persisted across different calls

**What was fixed:**

```typescript
// Lines 108-114: Added 'open' dependency to useEffect
useEffect(() => {
  if (open && call) {
    setEditedTitle(call.title || "");
    setEditedSummary(call.summary || "");
    setIsEditing(false); // Reset editing state when opening
  }
}, [call, open]);
```

**User impact:** Dialog correctly shows current call data, editing state resets properly

---

### CallDetailHeader.tsx

**Location:** `src/components/call-detail/CallDetailHeader.tsx`

**What it does:** Header section of call detail dialog

**What was broken:**

- No null check at component entry
- Could render with null call data

**What was fixed:**

```typescript
// Lines 35-38: Added defensive null check
if (!call) {
  return null;
}
```

**User impact:** Prevents crash if dialog somehow opens without call data

---

### ChangeSpeakerDialog.tsx

**Location:** `src/components/transcript-library/ChangeSpeakerDialog.tsx`

**What it does:** Dialog for changing speaker assignments in transcript

**What was broken:**

- Direct `.map()` on `availableSpeakers` without null check

**What was fixed:**

```typescript
// Line 54: Added default empty array
{(availableSpeakers || []).map((speaker) => (
  <SelectItem key={speaker.email} value={speaker.email}>
    {speaker.name}
  </SelectItem>
))}
```

**User impact:** Dialog doesn't crash if availableSpeakers is undefined

---

### DragDropZones.tsx

**Location:** `src/components/transcript-library/DragDropZones.tsx`

**What it does:** Drag and drop zones for tag management

**What was broken:**

- Direct `.map()` on `tags` without null check

**What was fixed:**

```typescript
// Line 123: Added default empty array
{(tags || []).map((tag) => (
  <TagZone key={tag.id} tag={tag} />
))}
```

**User impact:** Drag zones don't crash if tags is undefined

---

### TagDropdown.tsx

**Location:** `src/components/transcript-library/TagDropdown.tsx`

**What it does:** Quick tag assignment dropdown

**What was broken:**

- Accessed `.length` without null check

**What was fixed:**

```typescript
// Line 42: Added null check before length
{tags && tags.length > 0 ? (
  <div>Show tags</div>
) : (
  <div>No tags</div>
)}
```

**User impact:** Dropdown doesn't crash if tags is null

---

### TagFilterPopover.tsx

**Location:** `src/components/transcript-library/TagFilterPopover.tsx`

**What it does:** Popover for filtering transcripts by tags

**What was broken:**

- Accessed `.length` without null check

**What was fixed:**

```typescript
// Line 38: Added null check before length
{!tags || tags.length === 0 ? (
  <div>No tags available</div>
) : (
  <div>Show tags</div>
)}
```

**User impact:** Filter popover doesn't crash if tags is null

---

### CallInviteesTab.tsx

**Location:** `src/components/call-detail/CallInviteesTab.tsx`

**What it does:** Tab showing meeting invitees/participants

**What was broken:**

- Called `name.split()` without checking if name exists

**What was fixed:**

```typescript
// Line 67: Added optional chaining and fallback
{invitee.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?'}
```

**User impact:** Invitees tab doesn't crash if invitee name is missing

---

### useCallDetailMutations.ts

**Location:** `src/hooks/useCallDetailMutations.ts`

**What it does:** Hook for call detail mutations (resync, update, etc.)

**What was broken:**

- Accessed `speaker.display_name` without checking if speaker exists

**What was fixed:**

```typescript
// Line 89: Added optional chaining and fallback
speaker_name: t.speaker?.display_name || 'Unknown',
speaker_email: t.speaker?.matched_calendar_invitee_email || null,
```

**User impact:** Transcript resync doesn't crash if speaker data is missing

---

### SmartExportDialog.tsx

**Location:** `src/components/SmartExportDialog.tsx`

**What it does:** Dialog for smart export with multiple format options

**What was broken:**

- No `Array.isArray()` check before `forEach()` on calendar_invitees

**What was fixed:**

```typescript
// Line 127: Added Array.isArray() validation
if (call.calendar_invitees && Array.isArray(call.calendar_invitees)) {
  call.calendar_invitees.forEach((inv: any) => {
    if (inv?.name) allParticipants.add(inv.name);
  });
}
```

**User impact:** Export dialog doesn't crash if calendar_invitees is not an array

---

### export-utils.ts

**Location:** `src/lib/export-utils.ts`

**What it does:** Core export utility functions

**What was broken:**

- No `Array.isArray()` check before `forEach()` on calendar_invitees

**What was fixed:**

```typescript
// Line 156: Added Array.isArray() validation
if ((call as any).calendar_invitees && Array.isArray((call as any).calendar_invitees)) {
  (call as any).calendar_invitees.forEach((inv: any) => {
    if (inv?.name && !participants.includes(inv.name)) {
      participants.push(inv.name);
    }
  });
}
```

**User impact:** Export functions don't crash if calendar_invitees is not an array

---

### export-utils-advanced.ts

**Location:** `src/lib/export-utils-advanced.ts`

**What it does:** Advanced export utilities (LLM context, narrative)

**What was broken:**

- No `Array.isArray()` check before `.map()` on calendar_invitees

**What was fixed:**

```typescript
// Line 219: Added Array.isArray() validation
} else if (call.calendar_invitees && Array.isArray(call.calendar_invitees) && call.calendar_invitees.length > 0) {
  content += `Invitees: ${call.calendar_invitees.map(inv => {
    if (includeOptions?.metadata !== false && inv?.email) {
      return `${inv.name} (${inv.email})`;
    }
    return inv?.name || 'Unknown';
  }).join(', ')}\n`;
}
```

**User impact:** Advanced export doesn't crash if calendar_invitees is not an array

---

### FilterBar.tsx

**Location:** `src/components/transcript-library/FilterBar.tsx`

**What it does:** Filter bar for transcript filtering

**What was broken:**

- No `Array.isArray()` check before `forEach()` in participant fetch

**What was fixed:**

```typescript
// Line 65: Added Array.isArray() validation
if (call.calendar_invitees && Array.isArray(call.calendar_invitees)) {
  call.calendar_invitees.forEach((invitee: any) => {
    if (invitee?.email) participantsSet.add(invitee.email);
  });
}
```

**User impact:** Filter bar doesn't crash when fetching participants

---

### InviteesPopover.tsx

**Location:** `src/components/transcript-library/InviteesPopover.tsx`

**What it does:** Popover displaying meeting invitees

**What was broken:**

- No `Array.isArray()` check before `.filter()` on invitees

**What was fixed:**

```typescript
// Line 14: Added Array.isArray() type check
if (!invitees || !Array.isArray(invitees) || invitees.length === 0) {
  return <span className="text-muted-foreground text-xs">No invitees</span>;
}

const externalCount = invitees.filter(i => i?.is_external).length;
```

**User impact:** Invitees popover doesn't crash if invitees is not an array

---

## Pattern Summary

### Pattern 1: Default to Empty Array

```typescript
(array || []).map(...)
```

**Used in:** ChangeSpeakerDialog, DragDropZones

### Pattern 2: Null Check Before Length

```typescript
array && array.length > 0
```

**Used in:** TagDropdown, TagFilterPopover

### Pattern 3: Array.isArray() Validation

```typescript
Array.isArray(array) && array.forEach(...)
```

**Used in:** SmartExportDialog, export-utils, export-utils-advanced, FilterBar, InviteesPopover

### Pattern 4: Optional Chaining

```typescript
object?.property?.method()
```

**Used in:** CallInviteesTab, useCallDetailMutations

### Pattern 5: Type Validation Before API

```typescript
const ids = items.filter(i => i?.id != null).map(i => Number(i.id));
if (ids.length === 0) return;
```

**Used in:** BulkActionToolbarEnhanced

---

## Testing Quick Check

If you suspect a white screen issue:

1. **Check browser console** - Look for TypeError
2. **Find component from error** - Stack trace shows which component
3. **Search this file** - Find the component in this quick ref
4. **Apply same pattern** - Use the pattern shown above
5. **Test the fix** - Reproduce the user action

---

## Related Files

- [Full Documentation](./white-screen-prevention.md) - Detailed explanation
- [TypeScript Best Practices](./typescript-best-practices.md) - Type safety
- [Component Testing](./component-testing.md) - Testing guidelines

---

**END OF QUICK REFERENCE**
