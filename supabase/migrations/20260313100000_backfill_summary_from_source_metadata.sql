-- Backfill recordings.summary from source_metadata->>'summary' for calls
-- where the column is null but the sync stored it in the metadata blob.
-- This covers all historical Fathom syncs done before the pipeline fix.

UPDATE recordings
SET summary = source_metadata->>'summary'
WHERE summary IS NULL
  AND source_metadata->>'summary' IS NOT NULL
  AND source_metadata->>'summary' != '';
