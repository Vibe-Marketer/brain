-- Migration: Backfill missing duration for Fathom recordings
-- Issue #108: 97% of recordings (1,532/1,581) have NULL duration
--
-- Root cause: Original bulk import set duration=NULL. The recordings table
-- already has recording_start_time and recording_end_time populated, so we
-- can compute duration directly without joining raw tables.
--
-- YouTube recordings (6 rows) also lack duration but their raw tables have
-- NULL youtube_duration as well — those require a YouTube API re-fetch and
-- are handled separately via the import pipeline for new imports.

UPDATE recordings
SET duration = EXTRACT(EPOCH FROM (recording_end_time - recording_start_time))::INTEGER
WHERE duration IS NULL
  AND recording_start_time IS NOT NULL
  AND recording_end_time IS NOT NULL;
