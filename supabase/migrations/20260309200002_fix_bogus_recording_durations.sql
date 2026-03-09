-- Migration: Null out implausibly large durations from corrupt timestamp data
-- Issue #108: Two recordings had start_time in 2021 and end_time years later,
-- producing durations of 120M+ seconds (~4 years). These indicate bad data in
-- recording_end_time, not real call lengths. Cap at 12 hours (43200 seconds).

UPDATE recordings
SET duration = NULL
WHERE duration > 43200;
