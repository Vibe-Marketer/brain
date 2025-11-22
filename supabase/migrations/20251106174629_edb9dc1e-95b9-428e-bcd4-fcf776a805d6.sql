-- Add tracking columns to preserve user edits during re-sync
ALTER TABLE fathom_calls 
ADD COLUMN title_edited_by_user BOOLEAN DEFAULT FALSE,
ADD COLUMN summary_edited_by_user BOOLEAN DEFAULT FALSE;