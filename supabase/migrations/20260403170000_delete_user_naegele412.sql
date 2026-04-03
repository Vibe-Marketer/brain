-- One-off migration: Delete user naegele412@gmail.com
-- Deletes user (cascades all data).

BEGIN;

-- Delete the user — ON DELETE CASCADE handles all related tables
DELETE FROM auth.users WHERE id = '2cb229ba-a701-48b1-95f7-49d2579b7966';

COMMIT;
