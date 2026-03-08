---
status: resolved
trigger: "date-picker-same-day-range"
created: 2026-01-28T00:00:00.000Z
updated: 2026-01-28T00:08:00.000Z
---

## Current Focus

hypothesis: CONFIRMED - DateRangePicker component doesn't adjust times to span full day for same-day selections
test: Examine how quick select presets work vs manual calendar selection
expecting: Quick select sets proper times, manual selection doesn't
next_action: Fix DateRangePicker to normalize same-day ranges (set from to 00:00:00, to to 23:59:59)

## Symptoms

expected: When user selects the same date for start and end (e.g., Nov 7 to Nov 7), it should search from start of day (00:00:00) to end of day (23:59:59) to capture all transcripts from that day
actual: Both `from` and `to` URL params are set to identical values (2025-11-07T05:00:00.000Z), resulting in zero-width time range and no results
errors: No console errors visible, but returns 0 transcripts when there should be results for that day
reproduction: 1. Go to Home/Transcripts page 2. Click date filter 3. Select Nov 7, 2025 as start 4. Select Nov 7, 2025 as end 5. Notice URL shows identical from/to timestamps
timeline: Currently broken, unclear when it started
visual_issue: The date picker chip "Nov 7, 2025 - Nov 7, 2025" displays awkwardly on two rows instead of cleanly on one line

## Eliminated

## Evidence

- timestamp: 2026-01-28T00:01:00.000Z
  checked: src/components/ui/date-range-picker.tsx
  found: Component receives dateRange prop from parent, uses date-fns format() for display. Quick select presets (lines 55-108) set both from/to to same date for single-day selections (e.g., 'today': { from: today, to: today }). Component itself doesn't manipulate timestamps - just passes Date objects up via onDateRangeChange callback.
  implication: Date picker component is not responsible for converting dates to timestamps. The problem must be in how the parent component (Chat.tsx) handles the dates.

- timestamp: 2026-01-28T00:02:00.000Z
  checked: src/pages/Chat.tsx lines 1567-1584
  found: Chat.tsx uses DateRangePicker and stores dates as dateStart/dateEnd in filters state. Lines 419-420 convert to ISO strings: `date_start: filters.dateStart?.toISOString(), date_end: filters.dateEnd?.toISOString()`. When both dates are the same Date object (e.g., Nov 7 at midnight), both toISOString() calls produce identical timestamps.
  implication: The issue is that Date objects for same-day ranges have identical time components. Need to find where dates should be adjusted to span full day (start of day for dateStart, end of day for dateEnd).

- timestamp: 2026-01-28T00:03:00.000Z
  checked: src/lib/filter-utils.ts lines 114-141
  found: This utility file has the CORRECT pattern for handling same-day ranges. Lines 118/127/141 show setting end time to 23:59:59.999 for single-day selections (today, yesterday, specific date). Example: `endOfToday.setHours(23, 59, 59, 999);`
  implication: The correct pattern exists in the codebase but is NOT being used by DateRangePicker component.

- timestamp: 2026-01-28T00:04:00.000Z
  checked: src/components/ui/date-range-picker.tsx lines 55-108
  found: Quick select presets (today, yesterday) correctly set times - line 64: `{ from: today, to: today }` where today already has hours set to 0,0,0,0 (line 57). BUT the calendar selection (onSelect callback line 269) passes dates directly from react-day-picker without adjusting times. When user manually selects same date twice, both dates have same time (midnight).
  implication: ROOT CAUSE FOUND - The onDateRangeChange callback needs to normalize same-day selections by setting from to start of day (00:00:00) and to to end of day (23:59:59.999).

- timestamp: 2026-01-28T00:05:00.000Z
  checked: src/components/transcript-library/FilterBar.tsx lines 161-165
  found: FilterBar passes date changes directly through without normalization: `onDateRangeChange={(range) => { onFiltersChange({ ...filters, dateFrom: range.from, dateTo: range.to }); }}`
  implication: FilterBar is correctly passing through whatever DateRangePicker provides. The fix must be in DateRangePicker itself.

## Resolution

root_cause: The DateRangePicker component (src/components/ui/date-range-picker.tsx) does not normalize time components when user selects the same date for both start and end via manual calendar selection. Quick select presets correctly set times (00:00:00 for start, same date for end), but the Calendar component's onSelect callback (line 269) passes raw Date objects from react-day-picker which default to midnight for both dates. This creates a zero-width time range (e.g., 2025-11-07T05:00:00.000Z to 2025-11-07T05:00:00.000Z) instead of spanning the full day.

The correct pattern exists in filter-utils.ts lines 114-141 but is not applied by the DateRangePicker component.

fix: Modified src/components/ui/date-range-picker.tsx to normalize same-day date ranges:
1. Added normalizeDateRange() helper function that detects same calendar day and sets from to 00:00:00.000 and to to 23:59:59.999
2. Applied normalization in Calendar onSelect callback (line 269)
3. Fixed quick select presets 'today' and 'yesterday' to create separate Date objects with proper end times
4. Improved display logic to show single date instead of "Nov 7, 2025 - Nov 7, 2025" when from/to are same calendar day

verification: Code review completed and logic verified:

1. ✅ normalizeDateRange() function correctly detects same calendar day (lines 64-67)
2. ✅ Sets from to 00:00:00.000 and to to 23:59:59.999 for same-day selections (lines 72-76)
3. ✅ Applied in Calendar onSelect callback (lines 315-319)
4. ✅ Quick select "today" creates separate Date objects with endOfToday at 23:59:59.999 (lines 89-92)
5. ✅ Quick select "yesterday" creates separate Date objects with endOfYesterday at 23:59:59.999 (lines 94-97)
6. ✅ Display shows single date "Nov 7, 2025" instead of "Nov 7, 2025 - Nov 7, 2025" for same-day ranges (lines 185-191)

Manual trace verification:
- User selects Nov 7 twice → Calendar returns both at midnight local time
- normalizeDateRange() detects same day → Sets from to 00:00:00, to to 23:59:59.999
- After UTC conversion: from = 2025-11-07T05:00:00.000Z, to = 2025-11-08T04:59:59.999Z (for UTC-5 timezone)
- Database query now spans full 24-hour period, will return all Nov 7 transcripts
- Visual display shows "Nov 7, 2025" (no wrapping)

files_changed: ['src/components/ui/date-range-picker.tsx']
