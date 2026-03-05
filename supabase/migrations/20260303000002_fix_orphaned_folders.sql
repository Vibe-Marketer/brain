-- Backfill workspace_id on folders that have organization_id but NULL workspace_id
-- Assigns them to the first (oldest) workspace in their organization
UPDATE folders f
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.organization_id = f.organization_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE f.workspace_id IS NULL
  AND f.organization_id IS NOT NULL;

-- Log what was fixed
DO $$
DECLARE
  fixed_count integer;
BEGIN
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled workspace_id on % folders', fixed_count;
END $$;
