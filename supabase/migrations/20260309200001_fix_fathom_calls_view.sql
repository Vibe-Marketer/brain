-- Migration: Fix fathom_calls view to include canonical_recording_id
-- Issue #108: Invitees data exists but appears missing in the UI
--
-- Bug: The fathom_calls VIEW was created before the canonical_recording_id
-- column was added to fathom_raw_calls. It uses explicit column names, so
-- it silently omits canonical_recording_id. Queries in raw-calls.service.ts
-- filter on canonical_recording_id via this view and return null, hiding
-- the existing calendar_invitees data.
--
-- Fix: Recreate the view using SELECT * so all current and future columns
-- from fathom_raw_calls are automatically included.

CREATE OR REPLACE VIEW fathom_calls AS
  SELECT * FROM fathom_raw_calls;
