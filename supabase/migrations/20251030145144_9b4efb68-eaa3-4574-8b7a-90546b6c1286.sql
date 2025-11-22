-- Add host/recorder information to fathom_calls table
ALTER TABLE fathom_calls 
ADD COLUMN IF NOT EXISTS recorded_by_name TEXT,
ADD COLUMN IF NOT EXISTS recorded_by_email TEXT;

-- Add index for faster host lookups
CREATE INDEX IF NOT EXISTS idx_fathom_calls_recorded_by_email ON fathom_calls(recorded_by_email);