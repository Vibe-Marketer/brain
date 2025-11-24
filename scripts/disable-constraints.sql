-- Disable all foreign key constraints
ALTER TABLE user_settings DISABLE TRIGGER ALL;
ALTER TABLE fathom_calls DISABLE TRIGGER ALL;
ALTER TABLE fathom_transcripts DISABLE TRIGGER ALL;
ALTER TABLE webhook_deliveries DISABLE TRIGGER ALL;
ALTER TABLE call_categories DISABLE TRIGGER ALL;
ALTER TABLE call_category_assignments DISABLE TRIGGER ALL;
ALTER TABLE sync_jobs DISABLE TRIGGER ALL;

-- Alternative: Drop constraints temporarily
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE fathom_calls DROP CONSTRAINT IF EXISTS fathom_calls_user_id_fkey;
ALTER TABLE fathom_transcripts DROP CONSTRAINT IF EXISTS fathom_transcripts_recording_id_fkey;
ALTER TABLE call_categories DROP CONSTRAINT IF EXISTS call_categories_user_id_fkey;
ALTER TABLE call_category_assignments DROP CONSTRAINT IF EXISTS call_category_assignments_call_recording_id_fkey;
